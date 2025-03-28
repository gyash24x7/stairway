import { getCardFromId, getCardId } from "@/libs/cards/card";
import { generateDeck, generateHands } from "@/libs/cards/hand";
import { CardSuit, type PlayingCard } from "@/libs/cards/types";
import { getBestCardPlayed } from "@/libs/cards/utils";
import { suggestCardToPlay, suggestDealWins } from "@/server/callbreak/bot.service";
import type { CreateGameInput, DeclareDealWinsInput, JoinGameInput, PlayCardInput } from "@/server/callbreak/inputs";
import {
	validateAddBots,
	validateDealWinDeclaration,
	validateJoinGame,
	validatePlayCard
} from "@/server/callbreak/validators";
import { emitGameEvent } from "@/server/utils/events";
import { generateAvatar, generateGameCode, generateName } from "@/server/utils/generator";
import { createLogger } from "@/server/utils/logger";
import { prisma } from "@/server/utils/prisma";
import type { Auth } from "@/types/auth";
import { type Callbreak, CallbreakEvent } from "@/types/callbreak";
import { ORPCError } from "@orpc/server";
import { CallBreakStatus } from "@prisma/client";

const logger = createLogger( "CallbreakService" );

export async function getBaseGameData( gameId: string ) {
	logger.debug( ">> getBaseGameData()" );

	const data = await prisma.callbreak.game.findUnique( {
		where: { id: gameId },
		include: { players: true }
	} );

	if ( !data ) {
		logger.error( "Game Not Found!" );
		throw new ORPCError( "NOT_FOUND", { message: "Game Not Found!" } );
	}

	const { players, ...game } = data;
	const playerMap: Callbreak.PlayerData = {};
	players.forEach( player => {
		playerMap[ player.id ] = player;
	} );

	logger.debug( "<< getBaseGameData()" );
	return { game, players: playerMap };
}

export async function getGameData( { game, players, authInfo }: Callbreak.Context & Auth.Context ) {
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

export async function createGame( { dealCount, trumpSuit }: CreateGameInput, { authInfo }: Auth.Context ) {
	logger.debug( ">> createGame()" );

	const code = generateGameCode();
	const { id, name, avatar } = authInfo;
	const game = await prisma.callbreak.game.create( { data: { code, dealCount, trumpSuit, createdBy: id } } );
	await prisma.callbreak.player.create( { data: { gameId: game.id, id, name, avatar } } );

	logger.debug( "<< createGame()" );
	return game;
}

export async function joinGame( input: JoinGameInput, { authInfo }: Auth.Context ) {
	logger.debug( ">> joinGame()" );

	const { game, alreadyJoined } = await validateJoinGame( input, authInfo );
	if ( alreadyJoined ) {
		logger.warn( "Player Already Joined: %s", authInfo.id );
		return game;
	}

	const player = await prisma.callbreak.player.create( {
		data: { gameId: game.id, id: authInfo.id, name: authInfo.name, avatar: authInfo.avatar }
	} );

	await publishCallbreakEvent( game.id, CallbreakEvent.PLAYER_JOINED, player );

	game.players.push( player );

	if ( game.players.length === 4 ) {
		logger.info( "All Players joined, Starting the game..." );

		const updatedGame = await prisma.callbreak.game.update( {
			where: { id: game.id },
			data: { status: CallBreakStatus.IN_PROGRESS }
		} );

		await publishCallbreakEvent( game.id, CallbreakEvent.ALL_PLAYERS_JOINED, updatedGame );
	}

	logger.debug( "<< joinGame()" );
	return game;
}

export async function addBots( { game, players }: Callbreak.Context ) {
	logger.debug( ">> addBots()" );

	const botCount = await validateAddBots( game, players );
	for ( let i = 0; i < botCount; i++ ) {
		const name = generateName();
		const avatar = generateAvatar();
		const bot = await prisma.callbreak.player.create( { data: { name, avatar, gameId: game.id, isBot: true } } );

		await publishCallbreakEvent( game.id, CallbreakEvent.PLAYER_JOINED, bot );
		players[ bot.id ] = bot;
	}

	const updatedGame = await prisma.callbreak.game.update( {
		where: { id: game.id },
		data: { status: CallBreakStatus.IN_PROGRESS }
	} );

	await publishCallbreakEvent( game.id, CallbreakEvent.ALL_PLAYERS_JOINED, updatedGame );

	setTimeout( async () => {
		logger.debug( "Creating new deal..." );
		await createDeal( { game: updatedGame, players } );
	}, 5000 );

	logger.debug( "<< addBots()" );
}

export async function createDeal( { game, players }: Callbreak.Context, lastDeal?: Callbreak.Deal ) {
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

	let i = 0;
	for ( const playerId of deal.playerOrder ) {
		const hand = hands[ i++ ];
		await prisma.callbreak.cardMapping.createMany( {
			data: hand.map( card => ( {
				cardId: getCardId( card ),
				dealId: deal.id,
				gameId: game.id,
				playerId
			} ) )
		} );

		await publishCallbreakEvent( game.id, CallbreakEvent.CARDS_DEALT, hand, playerId );
	}

	await publishCallbreakEvent( game.id, CallbreakEvent.DEAL_CREATED, deal );

	const startingPlayer = players[ playerOrder[ 0 ] ];
	if ( startingPlayer.isBot ) {
		setTimeout( async () => {
			const wins = suggestDealWins( hands[ 0 ], game.trumpSuit as CardSuit );
			await declareDealWins(
				{ dealId: deal.id, playerId: startingPlayer.id, gameId: game.id, wins },
				{ game, players }
			);
		}, 5000 );
	}

	logger.debug( "<< createDeal()" );
	return deal;
}

export async function declareDealWins( input: DeclareDealWinsInput, { game, players }: Callbreak.Context ) {
	logger.debug( ">> declareDealWins()" );

	let deal = await validateDealWinDeclaration( input, game );

	deal = await prisma.callbreak.deal.update( {
		where: { id_gameId: { id: input.dealId, gameId: game.id } },
		data: {
			declarations: { ...deal.declarations, [ input.playerId ]: input.wins },
			turnIdx: { increment: 1 }
		},
		include: { rounds: true }
	} );

	await publishCallbreakEvent(
		game.id,
		CallbreakEvent.DEAL_WIN_DECLARED,
		{ deal, by: players[ input.playerId ], wins: input.wins }
	);

	const nextPlayer = deal.playerOrder[ deal.turnIdx ];
	if ( players[ nextPlayer ]?.isBot ) {
		setTimeout( async () => {
			const mappings = await prisma.callbreak.cardMapping.findMany( {
				where: { gameId: game.id, dealId: deal.id, playerId: nextPlayer }
			} );

			const hand = mappings.map( cm => getCardFromId( cm.cardId ) );
			const wins = suggestDealWins( hand, game.trumpSuit as CardSuit );

			await declareDealWins(
				{ gameId: game.id, dealId: deal.id, wins, playerId: nextPlayer },
				{ game, players }
			);
		}, 5000 );
	}

	if ( deal.turnIdx === 4 ) {
		logger.info( "All players declared wins, Starting the round..." );

		deal = await prisma.callbreak.deal.update( {
			where: { id_gameId: { id: input.dealId, gameId: game.id } },
			data: { status: CallBreakStatus.IN_PROGRESS },
			include: { rounds: true }
		} );

		await publishCallbreakEvent( game.id, CallbreakEvent.ALL_DEAL_WINS_DECLARED, deal );

		setTimeout( async () => {
			await createRound( deal, { game, players } );
		}, 5000 );
	}

	logger.debug( "<< declareDealWins()" );
}

export async function createRound( deal: Callbreak.DealWithRounds, { game, players }: Callbreak.Context ) {
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

	await publishCallbreakEvent( game.id, CallbreakEvent.ROUND_CREATED, round );

	const firstPlayer = players[ playerOrder[ 0 ] ];
	if ( firstPlayer.isBot ) {
		setTimeout( async () => {
			const mappings = await prisma.callbreak.cardMapping.findMany( {
				where: { gameId: game.id, dealId: deal.id, playerId: firstPlayer.id }
			} );

			const hand = mappings.map( cm => getCardFromId( cm.cardId ) );
			const card = suggestCardToPlay( hand, deal, game.trumpSuit as CardSuit );

			await playCard(
				{
					gameId: game.id,
					dealId: deal.id,
					roundId: round.id,
					cardId: getCardId( card ),
					playerId: firstPlayer.id
				},
				{ game, players }
			);
		}, 5000 );
	}

	logger.debug( "<< createRound()" );
	return round;
}

export async function playCard( input: PlayCardInput, { game, players }: Callbreak.Context ) {
	logger.debug( ">> playCard()" );

	let { round } = await validatePlayCard( input, game );

	round = await prisma.callbreak.round.update( {
		where: { id_dealId_gameId: { id: round.id, gameId: game.id, dealId: input.dealId } },
		data: {
			suit: round.turnIdx === 0 ? getCardFromId( input.cardId ).suit : round.suit,
			cards: { ...round.cards, [ input.playerId ]: input.cardId },
			turnIdx: { increment: 1 }
		}
	} );

	await prisma.callbreak.cardMapping.delete( {
		where: { cardId_dealId_gameId: { cardId: input.cardId, gameId: game.id, dealId: input.dealId } }
	} );

	await publishCallbreakEvent(
		game.id,
		CallbreakEvent.CARD_PLAYED,
		{ round, card: input.cardId, by: input.playerId }
	);

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

			await playCard(
				{
					gameId: game.id,
					dealId: deal.id,
					roundId: round.id,
					cardId: getCardId( card ),
					playerId: nextPlayer.id
				},
				{ game, players }
			);
		}, 5000 );
	}

	if ( round.turnIdx === 4 ) {
		logger.info( "All players played their cards, Completing the round..." );

		const winningCard = getBestCardPlayed(
			Object.values( round.cards ).map( getCardFromId ),
			game.trumpSuit as CardSuit,
			round.suit as CardSuit
		);

		logger.info( "Winning Card: %s", winningCard );

		const winningPlayer = round.playerOrder.find( p => round.cards[ p ] === getCardId( winningCard! ) );
		logger.info( "Player %s won the round", winningPlayer );

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

		await publishCallbreakEvent(
			game.id,
			CallbreakEvent.ROUND_COMPLETED,
			{ round, winner: players[ winningPlayer! ], deal }
		);

		const completedRounds = deal.rounds.filter( r => r.completed ).length;

		if ( completedRounds === 13 ) {
			logger.info( "All rounds completed, Calculating scores for deal..." );

			deal = await prisma.callbreak.deal.update( {
				where: { id_gameId: { id: input.dealId, gameId: game.id } },
				data: { status: CallBreakStatus.COMPLETED },
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

			await publishCallbreakEvent( game.id, CallbreakEvent.DEAL_COMPLETED, { deal, score } );

			const completedDeals = await prisma.callbreak.deal.count( {
				where: { gameId: game.id, status: CallBreakStatus.COMPLETED }
			} );

			game = await prisma.callbreak.game.update( {
				where: { id: game.id },
				data: {
					scores: [ score, ...game.scores ],
					status: completedDeals === game.dealCount
						? CallBreakStatus.COMPLETED
						: CallBreakStatus.IN_PROGRESS
				}
			} );

			if ( completedDeals === game.dealCount ) {
				logger.info( "All deals completed, Game Over!" );
				await publishCallbreakEvent( game.id, CallbreakEvent.GAME_COMPLETED, game );
			} else {
				logger.info( "Starting the next deal..." );
				setTimeout( async () => {
					await createDeal( { game, players }, deal );
				}, 5000 );
			}

		} else {
			logger.info( "Starting the next round..." );
			setTimeout( async () => {
				await createRound( deal, { game, players } );
			}, 5000 );
		}
	}

	logger.debug( "<< playCard()" );
	return round;
}

async function publishCallbreakEvent<E extends Callbreak.Event>(
	gameId: string,
	event: E,
	data: Callbreak.EventPayloads[E],
	playerId?: string
) {
	emitGameEvent( "callbreak", { gameId, event, data, playerId } );
}