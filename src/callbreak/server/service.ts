import type { AuthContext } from "@/auth/types";
import { suggestCardToPlay, suggestDealWins } from "@/callbreak/server/bot.service";
import type { CreateGameInput, DeclareDealWinsInput, JoinGameInput, PlayCardInput } from "@/callbreak/server/inputs";
import * as repository from "@/callbreak/server/repository";
import * as validators from "@/callbreak/server/validators";
import { type Callbreak, CallbreakEvent } from "@/callbreak/types";
import { getCardFromId, getCardId } from "@/libs/cards/card";
import { generateDeck, generateHands } from "@/libs/cards/hand";
import { CardSuit, type PlayingCard } from "@/libs/cards/types";
import { getBestCardPlayed } from "@/libs/cards/utils";
import { createLogger } from "@/shared/utils/logger";
import { ORPCError } from "@orpc/server";

const logger = createLogger( "CallbreakService" );

export async function getBaseGameData( gameId: string ) {
	logger.debug( ">> getBaseGameData()" );

	const data = await repository.getGameById( gameId );
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

export async function getGameData( { game, players, authInfo }: Callbreak.Context & AuthContext ) {
	logger.debug( ">> getGameData()" );

	const activeDeal = await repository.getActiveDeal( game.id );
	let activeRound: Callbreak.Round | null = null;
	const hand: PlayingCard[] = [];

	if ( !!activeDeal ) {
		const cardMappings = await repository.getCardMappingsForPlayer( activeDeal.id, game.id, authInfo.id );
		hand.push( ...cardMappings.map( cm => getCardFromId( cm.cardId ) ) );
		activeRound = await repository.getActiveRound( activeDeal.id, game.id );
	}

	logger.debug( "<< getGameData()" );
	return { game, players, currentDeal: activeDeal, currentRound: activeRound, playerId: authInfo.id, hand };
}

export async function createGame( { dealCount, trumpSuit }: CreateGameInput, { authInfo }: AuthContext ) {
	logger.debug( ">> createGame()" );

	const { id, name, avatar } = authInfo;
	const game = await repository.createGame( { dealCount, trumpSuit, createdBy: id } );
	await repository.createPlayer( { gameId: game.id, id, name, avatar } );

	logger.debug( "<< createGame()" );
	return game;
}

export async function joinGame( input: JoinGameInput, { authInfo }: AuthContext ) {
	logger.debug( ">> joinGame()" );

	const { game, alreadyJoined } = await validators.validateJoinGame( input, authInfo );
	if ( alreadyJoined ) {
		logger.warn( "Player Already Joined: %s", authInfo.id );
		return game;
	}

	const { id, name, avatar } = authInfo;
	const player = await repository.createPlayer( { gameId: game.id, name, avatar, id } );
	await publishCallbreakEvent( game.id, CallbreakEvent.PLAYER_JOINED, player );

	game.players.push( player );

	if ( game.players.length === 4 ) {
		logger.info( "All Players joined, Starting the game..." );
		const updatedGame = await repository.updateGame( game.id, { status: "IN_PROGRESS" } );
		await publishCallbreakEvent( game.id, CallbreakEvent.ALL_PLAYERS_JOINED, updatedGame );
	}

	logger.debug( "<< joinGame()" );
	return game;
}

export async function addBots( { game, players }: Callbreak.Context ) {
	logger.debug( ">> addBots()" );

	const botCount = await validators.validateAddBots( game, players );
	for ( let i = 0; i < botCount; i++ ) {
		const bot = await repository.createPlayer( { gameId: game.id, isBot: 1 } );
		await publishCallbreakEvent( game.id, CallbreakEvent.PLAYER_JOINED, bot );
		players[ bot.id ] = bot;
	}

	const updatedGame = await repository.updateGame( game.id, { status: "IN_PROGRESS" } );
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

	const deal = await repository.createDeal( { gameId: game.id, playerOrder: playerOrder.join( "," ) } );

	let i = 0;
	for ( const playerId of deal.playerOrder ) {
		const hand = hands[ i++ ];
		await repository.createCardMappings( hand.map( card => ( {
			cardId: getCardId( card ),
			dealId: deal.id,
			gameId: game.id,
			playerId
		} ) ) );

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

	let deal = await validators.validateDealWinDeclaration( input );

	await repository.createDealScore( {
		dealId: input.dealId,
		gameId: game.id,
		playerId: input.playerId,
		declarations: input.wins
	} );

	deal.turnIdx++;
	await repository.updateDeal( input.dealId, game.id, { turnIdx: deal.turnIdx } );

	await publishCallbreakEvent(
		game.id,
		CallbreakEvent.DEAL_WIN_DECLARED,
		{ deal, by: players[ input.playerId ], wins: input.wins }
	);

	const nextPlayer = deal.playerOrder[ deal.turnIdx ];
	if ( players[ nextPlayer ]?.isBot ) {
		setTimeout( async () => {
			const mappings = await repository.getCardMappingsForPlayer( input.dealId, game.id, nextPlayer );
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
		deal.status = "IN_PROGRESS";
		await repository.updateDeal( input.dealId, game.id, { status: "IN_PROGRESS" } );
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
	const playerOrder = !lastRound ? deal.playerOrder.split( "," ) : [
		...lastRound.playerOrder.split( "," ).slice( lastRound.playerOrder.indexOf( lastRound.winner! ) ),
		...lastRound.playerOrder.split( "," ).slice( 0, lastRound.playerOrder.indexOf( lastRound.winner! ) )
	];

	const round = await repository.createRound( {
		dealId: deal.id,
		gameId: game.id,
		playerOrder: playerOrder.join( "," )
	} );

	deal.rounds.unshift( round );

	await publishCallbreakEvent( game.id, CallbreakEvent.ROUND_CREATED, round );

	const firstPlayer = players[ playerOrder[ 0 ] ];
	if ( firstPlayer.isBot ) {
		setTimeout( async () => {
			const mappings = await repository.getCardMappingsForPlayer( deal.id, game.id, firstPlayer.id );
			const hand = mappings.map( cm => getCardFromId( cm.cardId ) );
			const cardsAlreadyPlayed = await repository.getCardsPlayedInDeal( deal.id, game.id );
			const card = suggestCardToPlay(
				hand,
				{ ...round, cards: {} },
				cardsAlreadyPlayed.map( cp => getCardFromId( cp.cardId ) ),
				game.trumpSuit as CardSuit
			);

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

	let { round } = await validators.validatePlayCard( input, game );

	await repository.createCardPlay( {
		roundId: round.id,
		dealId: input.dealId,
		gameId: game.id,
		playerId: input.playerId,
		cardId: input.cardId
	} );

	round.suit = round.turnIdx === 0 ? getCardFromId( input.cardId ).suit : round.suit;
	round.turnIdx++;

	await repository.updateRound( round.id, input.dealId, game.id, { suit: round.suit, turnIdx: round.turnIdx } );
	await repository.deleteCardMapping( input.cardId, input.dealId, game.id );

	await publishCallbreakEvent(
		game.id,
		CallbreakEvent.CARD_PLAYED,
		{ round, card: input.cardId, by: input.playerId }
	);

	let deal = await repository.getActiveDeal( game.id );

	const nextPlayer = players[ round.playerOrder[ round.turnIdx ] ];
	if ( nextPlayer?.isBot ) {
		logger.debug( "Next player is bot executing turn after 5s..." );
		setTimeout( async () => {
			logger.debug( "Executing play card for bot..." );
			const mappings = await repository.getCardMappingsForPlayer( deal.id, game.id, nextPlayer.id );
			const hand = mappings.map( cm => getCardFromId( cm.cardId ) );
			const cardsAlreadyPlayed = await repository.getCardsPlayedInDeal( deal.id, game.id );
			const card = suggestCardToPlay(
				hand,
				round,
				cardsAlreadyPlayed.map( cp => getCardFromId( cp.cardId ) ),
				game.trumpSuit as CardSuit
			);

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

		const winningPlayer = round.playerOrder.split( "," )
			.find( p => round.cards[ p ] === getCardId( winningCard! ) );

		logger.info( "Player %s won the round", winningPlayer );

		round.completed = 1;
		round.winner = winningPlayer ?? null;
		await repository.updateRound( round.id, input.dealId, game.id, { completed: 1, winner: winningPlayer } );

		const wins: Record<string, number> = {};
		Object.keys( players ).forEach( p => {
			wins[ p ] = deal.rounds.filter( r => r.winner === p ).length;
			if ( winningPlayer === p ) {
				wins[ p ] = wins[ p ] + 1;
			}
		} );

		await Promise.all( Object.keys( wins ).map( playerId => {
			deal.scores[ playerId ].wins = wins[ playerId ];
			return repository.updateDealScore( input.dealId, game.id, playerId, { wins: wins[ playerId ] } );
		} ) );

		await publishCallbreakEvent(
			game.id,
			CallbreakEvent.ROUND_COMPLETED,
			{ round, winner: players[ winningPlayer! ], deal }
		);

		const completedRounds = deal.rounds.filter( r => r.completed ).length;

		if ( completedRounds === 13 ) {
			logger.info( "All rounds completed, Calculating scores for deal..." );
			await repository.updateDeal( input.dealId, game.id, { status: "COMPLETED" } );

			const score: Record<string, number> = {};
			Object.keys( players ).forEach( ( playerId ) => {
				const { declarations: declared, wins: won } = deal.scores[ playerId ];
				if ( declared > won ) {
					score[ playerId ] = ( -10 * declared );
				} else {
					score[ playerId ] = ( 10 * declared ) + ( 2 * ( won - declared ) );
				}
			} );

			await publishCallbreakEvent( game.id, CallbreakEvent.DEAL_COMPLETED, { deal, score } );
			const completedDeals = await repository.getCompletedDealCount( game.id );

			await repository.updateGame(
				game.id,
				{ status: completedDeals === game.dealCount ? "COMPLETED" : "IN_PROGRESS" }
			);

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
	console.log( "callbreak", { gameId, event, data, playerId } );
}