import {
	CardSuit,
	generateDeck,
	generateHands,
	getBestCardPlayed,
	getCardFromId,
	getCardId,
	type PlayingCard
} from "@stairway/cards";
import { prisma } from "@stairway/prisma";
import type { Auth } from "@stairway/types/auth";
import type { Callbreak } from "@stairway/types/callbreak";
import { createLogger, generateAvatar, generateGameCode, generateName } from "@stairway/utils";
import { TRPCError } from "@trpc/server";
import { format } from "node:util";
import { suggestCardToPlay, suggestDealWins } from "./bot.service";
import { publishGameEvent, publishPlayerEvent } from "./events";
import type { CreateGameInput, DeclareDealWinsInput, JoinGameInput, PlayCardInput } from "./inputs";
import { validateAddBots, validateDealWinDeclaration, validateJoinGame, validatePlayCard } from "./validators";

const logger = createLogger( "CallbreakService" );

export async function getBaseGameData( gameId: string ) {
	logger.debug( ">> getBaseGameData()" );

	const data = await prisma.callbreak.game.findUnique( {
		where: { id: gameId },
		include: { players: true }
	} );

	if ( !data ) {
		logger.error( "Game Not Found!" );
		throw new TRPCError( { code: "NOT_FOUND", message: "Game Not Found!" } );
	}

	const { players, ...game } = data;
	const playerMap: Callbreak.PlayerData = {};
	players.forEach( player => {
		playerMap[ player.id ] = player;
	} );

	logger.debug( "<< getBaseGameData()" );
	return { game, players: playerMap };
}

export async function getGameData( game: Callbreak.Game, players: Callbreak.PlayerData, authInfo: Auth.Info ) {
	logger.debug( ">> getGameData()" );

	const currentDeal = await prisma.callbreak.deal.findFirst( {
		where: { gameId: game.id },
		orderBy: { createdAt: "desc" }
	} );

	let currentRound: Callbreak.Round | null = null;
	const hand: PlayingCard[] = [];

	if ( !!currentDeal ) {
		const cardMappings = await prisma.callbreak.cardMapping.findMany( {
			where: { gameId: game.id, dealId: currentDeal.id, playerId: authInfo.id }
		} );

		hand.push( ...cardMappings.map( cm => getCardFromId( cm.cardId ) ) );
		currentRound = await prisma.callbreak.round.findFirst( {
			where: { gameId: game.id, dealId: currentDeal.id },
			orderBy: { createdAt: "desc" }
		} );
	}

	logger.debug( "<< getGameData()" );
	return { game, players, currentDeal, currentRound, playerId: authInfo.id, hand };
}

export async function createGame( { dealCount, trumpSuit }: CreateGameInput, { id, name, avatar }: Auth.Info ) {
	logger.debug( ">> createGame()" );

	const code = generateGameCode();
	const game = await prisma.callbreak.game.create( { data: { code, dealCount, trumpSuit, createdBy: id } } );
	await prisma.callbreak.player.create( { data: { gameId: game.id, id, name, avatar } } );

	logger.debug( "<< createGame()" );
	return game;
}

export async function joinGame( input: JoinGameInput, authInfo: Auth.Info ) {
	logger.debug( ">> joinGame()" );

	const { game, alreadyJoined } = await validateJoinGame( input, authInfo );
	if ( alreadyJoined ) {
		logger.warn( format( "Player Already Joined: %s", authInfo.id ) );
		return game;
	}

	const player = await prisma.callbreak.player.create( {
		data: { gameId: game.id, id: authInfo.id, name: authInfo.name, avatar: authInfo.avatar }
	} );

	publishGameEvent( game.id, "player-joined", player );

	game.players.push( player );

	if ( game.players.length === 4 ) {
		logger.info( "All Players joined, Starting the game..." );

		const updatedGame = await prisma.callbreak.game.update( {
			where: { id: game.id },
			data: { status: "IN_PROGRESS" }
		} );

		publishGameEvent( game.id, "all-players-joined", updatedGame );
	}

	logger.debug( "<< joinGame()" );
	return game;
}

export async function addBots( game: Callbreak.Game, players: Callbreak.PlayerData ) {
	logger.debug( ">> addBots()" );

	const botCount = await validateAddBots( game, players );
	for ( let i = 0; i < botCount; i++ ) {
		const name = generateName();
		const avatar = generateAvatar();
		const bot = await prisma.callbreak.player.create( { data: { name, avatar, gameId: game.id, isBot: true } } );

		publishGameEvent( game.id, "player-joined", bot );
		players[ bot.id ] = bot;
	}

	const updatedGame = await prisma.callbreak.game.update( {
		where: { id: game.id },
		data: { status: "IN_PROGRESS" }
	} );

	publishGameEvent( game.id, "all-players-joined", updatedGame );

	setTimeout( async () => {
		logger.debug( "Creating new deal..." );
		await createDeal( updatedGame, players );
	}, 5000 );

	logger.debug( "<< addBots()" );
}

export async function createDeal( game: Callbreak.Game, players: Callbreak.PlayerData, lastDeal?: Callbreak.Deal ) {
	logger.debug( ">> createDeal()" );

	const deck = generateDeck();
	const hands = generateHands( deck, 4 );
	const playerIds = Object.keys( players ).toSorted();
	const playerOrder = !lastDeal ?
		[
			...playerIds.slice( playerIds.indexOf( game.createdBy ) ),
			...playerIds.slice( 0, playerIds.indexOf( game.createdBy ) )
		] :
		[ ...lastDeal.playerOrder.slice( 1 ), lastDeal.playerOrder[ 0 ] ];

	const deal = await prisma.callbreak.deal.create( { data: { gameId: game.id, playerOrder } } );

	for ( const playerId of deal.playerOrder ) {
		const hand = hands.shift() ?? [];
		await prisma.callbreak.cardMapping.createMany( {
			data: hand.map( card => ( {
				cardId: getCardId( card ),
				dealId: deal.id,
				gameId: game.id,
				playerId
			} ) )
		} );

		publishPlayerEvent( game.id, playerId, "cards-dealt", hand );
	}

	publishGameEvent( game.id, "deal-created", deal );

	logger.debug( "<< createDeal()" );
	return deal;
}

export async function declareDealWins(
	input: DeclareDealWinsInput,
	game: Callbreak.Game,
	players: Callbreak.PlayerData,
	playerId: string
) {
	logger.debug( ">> declareDealWins()" );

	let deal = await validateDealWinDeclaration( input, game, playerId );

	deal = await prisma.callbreak.deal.update( {
		where: { id_gameId: { id: input.dealId, gameId: game.id } },
		data: {
			declarations: { ...deal.declarations, [ playerId ]: input.wins },
			turnIdx: { increment: 1 }
		},
		include: { rounds: true }
	} );

	publishGameEvent( game.id, "deal-win-declared", { deal, by: players[ playerId ], wins: input.wins } );

	const nextPlayer = deal.playerOrder[ deal.turnIdx ];
	if ( players[ nextPlayer ]?.isBot ) {
		setTimeout( async () => {
			const mappings = await prisma.callbreak.cardMapping.findMany( {
				where: { gameId: game.id, dealId: deal.id, playerId: nextPlayer }
			} );

			const hand = mappings.map( cm => getCardFromId( cm.cardId ) );
			const wins = suggestDealWins( hand, game.trumpSuit as CardSuit );

			await declareDealWins( { gameId: game.id, dealId: deal.id, wins }, game, players, nextPlayer );
		}, 5000 );
	}

	if ( deal.turnIdx === 4 ) {
		logger.info( "All players declared wins, Starting the round..." );

		deal = await prisma.callbreak.deal.update( {
			where: { id_gameId: { id: input.dealId, gameId: game.id } },
			data: { status: "IN_PROGRESS" },
			include: { rounds: true }
		} );

		publishGameEvent( game.id, "all-deal-wins-declared", deal );

		setTimeout( async () => {
			await createRound( deal, game, players );
		}, 5000 );
	}

	logger.debug( "<< declareDealWins()" );
}

export async function createRound(
	deal: Callbreak.DealWithRounds,
	game: Callbreak.Game,
	players: Callbreak.PlayerData
) {
	logger.debug( ">> createRound()" );

	const lastRound = deal.rounds[ 0 ];
	const playerOrder = !lastRound ? deal.playerOrder : [
		...lastRound.playerOrder.slice( lastRound.playerOrder.indexOf( lastRound.winner! ) ),
		...lastRound.playerOrder.slice( 0, lastRound.playerOrder.indexOf( lastRound.winner! ) )
	];

	const round = await prisma.callbreak.round.create( {
		data: { dealId: deal.id, gameId: game.id, playerOrder }
	} );

	deal.rounds.unshift( round );

	publishGameEvent( game.id, "round-created", round );

	const firstPlayer = players[ playerOrder[ 0 ] ];
	if ( firstPlayer.isBot ) {
		setTimeout( async () => {
			const mappings = await prisma.callbreak.cardMapping.findMany( {
				where: { gameId: game.id, dealId: deal.id, playerId: firstPlayer.id }
			} );

			const hand = mappings.map( cm => getCardFromId( cm.cardId ) );
			const card = suggestCardToPlay( hand, deal, game.trumpSuit as CardSuit );
			const playCardInput = { gameId: game.id, dealId: deal.id, roundId: round.id, cardId: getCardId( card ) };

			await playCard( playCardInput, game, players, firstPlayer.id );
		}, 5000 );
	}

	logger.debug( "<< createRound()" );
	return round;
}

export async function playCard(
	input: PlayCardInput,
	game: Callbreak.Game,
	players: Callbreak.PlayerData,
	playerId: string
) {
	logger.debug( ">> playCard()" );

	let { round } = await validatePlayCard( input, game, playerId );

	round = await prisma.callbreak.round.update( {
		where: { id_dealId_gameId: { id: round.id, gameId: game.id, dealId: input.dealId } },
		data: {
			suit: round.turnIdx === 0 ? getCardFromId( input.cardId ).suit : round.suit,
			cards: { ...round.cards, [ playerId ]: input.cardId },
			turnIdx: { increment: 1 }
		}
	} );

	await prisma.callbreak.cardMapping.delete( {
		where: { cardId_dealId_gameId: { cardId: input.cardId, gameId: game.id, dealId: input.dealId } }
	} );

	publishGameEvent( game.id, "card-played", { round, card: input.cardId, by: playerId } );

	let deal = await prisma.callbreak.deal.findUniqueOrThrow( {
		where: { id_gameId: { id: input.dealId, gameId: game.id } },
		include: { rounds: { orderBy: { createdAt: "desc" } } }
	} );

	const nextPlayer = players[ round.playerOrder[ round.turnIdx ] ];
	if ( nextPlayer?.isBot ) {
		logger.debug( "Next player is bot executing turn after 5s..." );
		setTimeout( async () => {
			logger.debug( "Executing play card for bot..." );
			const mappings = await prisma.callbreak.cardMapping.findMany( {
				where: { gameId: game.id, dealId: deal.id, playerId: nextPlayer.id }
			} );

			const hand = mappings.map( cm => getCardFromId( cm.cardId ) );
			const card = suggestCardToPlay( hand, deal, game.trumpSuit as CardSuit );
			const playCardInput = { gameId: game.id, dealId: deal.id, roundId: round.id, cardId: getCardId( card ) };

			await playCard( playCardInput, game, players, nextPlayer.id );
		}, 5000 );
	}

	if ( round.turnIdx === 4 ) {
		logger.info( "All players played their cards, Completing the round..." );

		const winningCard = getBestCardPlayed(
			Object.values( round.cards ).map( getCardFromId ),
			game.trumpSuit as CardSuit,
			round.suit as CardSuit
		);

		logger.info( format( "Winning Card: %s", winningCard ) );

		const winningPlayer = round.playerOrder.find( p => round.cards[ p ] === getCardId( winningCard! ) );
		logger.info( format( "Player %s won the round", winningPlayer ) );

		round = await prisma.callbreak.round.update( {
			where: { id_dealId_gameId: { id: round.id, gameId: game.id, dealId: input.dealId } },
			data: {
				completed: true,
				winner: winningPlayer
			}
		} );

		const wins: Record<string, number> = {};
		Object.keys( players ).forEach( p => {
			wins[ p ] = deal.rounds.filter( r => r.winner === p ).length;
			if ( winningPlayer === p ) {
				wins[ p ] = wins[ p ] + 1;
			}
		} );

		deal = await prisma.callbreak.deal.update( {
			where: { id_gameId: { id: input.dealId, gameId: game.id } },
			data: { wins: { ...wins } },
			include: { rounds: { orderBy: { createdAt: "desc" } } }
		} );

		publishGameEvent( game.id, "round-completed", { round, winner: players[ winningPlayer! ], deal } );

		const completedRounds = deal.rounds.filter( r => r.completed ).length;

		if ( completedRounds === 13 ) {
			logger.info( "All rounds completed, Calculating scores for deal..." );

			deal = await prisma.callbreak.deal.update( {
				where: { id_gameId: { id: input.dealId, gameId: game.id } },
				data: { status: "COMPLETED" },
				include: { rounds: { orderBy: { createdAt: "desc" } } }
			} );

			const score: Record<string, number> = {};
			Object.keys( players ).forEach( ( playerId ) => {
				const declared = deal.declarations[ playerId ];
				const won = wins[ playerId ];

				if ( declared > won ) {
					score[ playerId ] = ( -10 * declared );
				} else {
					score[ playerId ] = ( 10 * declared ) + ( 2 * ( won - declared ) );
				}
			} );

			publishGameEvent( game.id, "deal-completed", { deal, score } );

			const completedDeals = await prisma.callbreak.deal.count( {
				where: { gameId: game.id, status: "COMPLETED" }
			} );

			game = await prisma.callbreak.game.update( {
				where: { id: game.id },
				data: {
					status: completedDeals === game.dealCount ? "COMPLETED" : "IN_PROGRESS",
					scores: [ score, ...game.scores ]
				}
			} );

			if ( completedDeals === game.dealCount ) {
				logger.info( "All deals completed, Game Over!" );
				publishGameEvent( game.id, "game-completed", game );
			} else {
				logger.info( "Starting the next deal..." );
				setTimeout( async () => {
					await createDeal( game, players, deal );
				}, 5000 );
			}

		} else {
			logger.info( "Starting the next round..." );
			setTimeout( async () => {
				await createRound( deal, game, players );
			}, 5000 );
		}
	}

	logger.debug( "<< playCard()" );
	return round;
}