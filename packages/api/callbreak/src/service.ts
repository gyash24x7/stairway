import {
	createLogger,
	generateAvatar,
	generateName,
	prisma,
	publishCallbreakGameEvent,
	publishCallbreakPlayerEvent,
	type UserAuthInfo
} from "@stairway/api/utils";
import {
	CardSuit,
	generateDeck,
	generateGameCode,
	generateHands,
	getBestCardPlayed,
	getCardFromId,
	getCardId,
	type PlayingCard
} from "@stairway/cards";
import { TRPCError } from "@trpc/server";
import { format } from "node:util";
import { suggestCardToPlay, suggestDealWins } from "./bot.service.ts";
import { GameEvents } from "./constants.ts";
import type { CreateGameInput, DeclareDealWinsInput, JoinGameInput, PlayCardInput } from "./inputs.ts";
import type { Deal, DealWithRounds, Game, PlayerData, Round } from "./types.ts";
import { validateAddBots, validateDealWinDeclaration, validateJoinGame, validatePlayCard } from "./validators.ts";

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
	const playerMap: PlayerData = {};
	players.forEach( player => {
		playerMap[ player.id ] = player;
	} );

	logger.debug( "<< getBaseGameData()" );
	return { game, players: playerMap };
}

export async function getGameData( game: Game, players: PlayerData, authInfo: UserAuthInfo ) {
	logger.debug( ">> getGameData()" );

	const currentDeal = await prisma.callbreak.deal.findFirst( {
		where: { gameId: game.id },
		orderBy: { createdAt: "desc" }
	} );

	let currentRound: Round | null = null;
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

export async function createGame( { dealCount, trumpSuit }: CreateGameInput, { id, name, avatar }: UserAuthInfo ) {
	logger.debug( ">> createGame()" );

	const code = generateGameCode();
	const game = await prisma.callbreak.game.create( { data: { code, dealCount, trumpSuit, createdBy: id } } );
	await prisma.callbreak.player.create( { data: { gameId: game.id, id, name, avatar } } );

	logger.debug( "<< createGame()" );
	return game;
}

export async function joinGame( input: JoinGameInput, authInfo: UserAuthInfo ) {
	logger.debug( ">> joinGame()" );

	const { game, alreadyJoined } = await validateJoinGame( input, authInfo );
	if ( alreadyJoined ) {
		logger.warn( format( "Player Already Joined: %s", authInfo.id ) );
		return game;
	}

	const player = await prisma.callbreak.player.create( {
		data: { gameId: game.id, id: authInfo.id, name: authInfo.name, avatar: authInfo.avatar }
	} );

	publishCallbreakGameEvent( game.id, GameEvents.PLAYER_JOINED, player );

	game.players.push( player );

	if ( game.players.length === 4 ) {
		logger.info( "All Players joined, Starting the game..." );

		const updatedGame = await prisma.callbreak.game.update( {
			where: { id: game.id },
			data: { status: "IN_PROGRESS" }
		} );

		publishCallbreakGameEvent( game.id, GameEvents.ALL_PLAYERS_JOINED, updatedGame );
	}

	logger.debug( "<< joinGame()" );
	return game;
}

export async function addBots( game: Game, players: PlayerData ) {
	logger.debug( ">> addBots()" );

	const botCount = await validateAddBots( game, players );
	for ( let i = 0; i < botCount; i++ ) {
		const name = generateName();
		const avatar = generateAvatar();
		const bot = await prisma.callbreak.player.create( { data: { name, avatar, gameId: game.id, isBot: true } } );

		publishCallbreakGameEvent( game.id, GameEvents.PLAYER_JOINED, bot );
		players[ bot.id ] = bot;
	}

	const updatedGame = await prisma.callbreak.game.update( {
		where: { id: game.id },
		data: { status: "IN_PROGRESS" }
	} );

	publishCallbreakGameEvent( game.id, GameEvents.ALL_PLAYERS_JOINED, updatedGame );

	setTimeout( async () => {
		logger.debug( "Creating new deal..." );
		await createDeal( updatedGame, players );
	}, 5000 );

	logger.debug( "<< addBots()" );
}

export async function createDeal( game: Game, players: PlayerData, lastDeal?: Deal ) {
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

		publishCallbreakPlayerEvent( game.id, playerId, GameEvents.CARDS_DEALT, hand );
	}

	publishCallbreakGameEvent( game.id, GameEvents.DEAL_CREATED, deal );

	logger.debug( "<< createDeal()" );
	return deal;
}

export async function declareDealWins(
	input: DeclareDealWinsInput,
	game: Game,
	players: PlayerData,
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

	publishCallbreakGameEvent(
		game.id,
		GameEvents.DEAL_WIN_DECLARED,
		{ deal, by: players[ playerId ], wins: input.wins }
	);

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

		publishCallbreakGameEvent( game.id, GameEvents.ALL_DEAL_WINS_DECLARED, deal );

		setTimeout( async () => {
			await createRound( deal, game, players );
		}, 5000 );
	}

	logger.debug( "<< declareDealWins()" );
}

export async function createRound( deal: DealWithRounds, game: Game, players: PlayerData ) {
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

	publishCallbreakGameEvent( game.id, GameEvents.ROUND_CREATED, { round, deal } );

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

export async function playCard( input: PlayCardInput, game: Game, players: PlayerData, playerId: string ) {
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

	publishCallbreakGameEvent( game.id, GameEvents.CARD_PLAYED, { round, card: input.cardId, by: playerId } );

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

		publishCallbreakGameEvent(
			game.id,
			GameEvents.ROUND_COMPLETED,
			{ round, deal, winner: players[ winningPlayer! ] }
		);

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

			publishCallbreakGameEvent( game.id, GameEvents.DEAL_COMPLETED, { deal, score } );

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
				publishCallbreakGameEvent( game.id, GameEvents.GAME_COMPLETED, game );
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