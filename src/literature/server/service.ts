import type { AuthContext } from "@/auth/types";
import { getCardDisplayString, getCardFromId, getCardId } from "@/libs/cards/card";
import { cardSetMap } from "@/libs/cards/constants";
import { generateDeck, generateHands, isCardInHand, removeCardsOfRank } from "@/libs/cards/hand";
import { CardRank, type CardSet } from "@/libs/cards/types";
import { shuffle } from "@/libs/cards/utils";
import { suggestAsks, suggestCalls, suggestCardSets, suggestTransfer } from "@/literature/server/bot.service";
import type {
	AskCardInput,
	CallSetInput,
	CreateGameInput,
	CreateTeamsInput,
	JoinGameInput,
	TransferTurnInput
} from "@/literature/server/inputs";
import * as repository from "@/literature/server/repository";
import {
	validateAddBots,
	validateAskCard,
	validateCallSet,
	validateCreateTeams,
	validateJoinGame,
	validateTransferTurn
} from "@/literature/server/validators";
import { type Literature, LiteratureEvent } from "@/literature/types";
import { generateGameCode } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { ORPCError } from "@orpc/server";

const logger = createLogger( "LiteratureService" );
const MAX_ASK_WEIGHT = 720;

export async function getGameData( gameId: string ) {
	logger.debug( ">> getGameData()" );

	const data = await repository.getGameById( gameId );

	if ( !data ) {
		logger.error( "Game Not Found!" );
		throw new ORPCError( "NOT_FOUND", { message: "Game Not Found!" } );
	}

	logger.debug( "<< getGameData()" );
	return data;
}

export async function getCardCounts( gameId: string ) {
	logger.debug( ">> getCardCounts()" );

	const cardMappings = await repository.getCardMappingsForGame( gameId );
	const cardCounts = cardMappings.reduce(
		( acc, mapping ) => {
			if ( !acc[ mapping.playerId ] ) {
				acc[ mapping.playerId ] = 0;
			}
			acc[ mapping.playerId ]++;
			return acc;
		},
		{} as Literature.CardCounts
	);

	logger.debug( "<< getCardCounts()" );
	return cardCounts;
}

export async function getPlayerHand( gameId: string, playerId: string ) {
	logger.debug( ">> getPlayerHand()" );

	const cardMappings = await repository.getCardMappingsForPlayer( gameId, playerId );
	const hand = cardMappings.map( mapping => getCardFromId( mapping.cardId ) );

	logger.debug( "<< getPlayerHand()" );
	return hand;
}

export async function getLastMoveData( lastMoveId: string ) {
	logger.debug( ">> getLastMove()" );

	const ask = await repository.getAskMove( lastMoveId );
	if ( !!ask ) {
		return { move: ask, isCall: false } as const;
	}

	const call = await repository.getCallMove( lastMoveId );
	if ( !!call ) {
		return { move: call, isCall: true } as const;
	}

	const transfer = await repository.getTransferMove( lastMoveId );
	if ( !!transfer ) {
		return { move: transfer, isCall: false } as const;
	}

	return { move: undefined, isCall: false } as const;
}

export async function getPreviousAsks( gameId: string ) {
	logger.debug( ">> getPreviousAsks()" );
	const asks = await repository.getAskMoves( gameId );
	logger.debug( "<< getPreviousAsks()" );
	return asks.slice( 0, 5 );
}

export async function getMetrics( game: Literature.Game, players: Literature.PlayerData, teams: Literature.TeamData ) {
	logger.debug( ">> getMetrics()" );

	const asks = await repository.getAskMoves( game.id );
	const calls = await repository.getCallMoves( game.id );
	const transfers = await repository.getTransferMoves( game.id );

	const metrics: Literature.Metrics = { player: [], team: [] };

	for ( const playerId of Object.keys( players ) ) {
		const asksByPlayer = asks.filter( ask => ask.playerId === playerId );
		const asksToPlayer = asks.filter( ask => ask.askedFrom === playerId );
		const successfulAsksByPlayer = asksByPlayer.filter( ask => ask.success );
		const successfulAsksToPlayer = asksToPlayer.filter( ask => ask.success );
		const callsByPlayer = calls.filter( call => call.playerId === playerId );
		const successfulCalls = callsByPlayer.filter( call => call.success );
		const transfersByPlayer = transfers.filter( transfer => transfer.playerId === playerId );

		metrics.player.push( {
			playerId,
			totalAsks: asksByPlayer.length,
			cardsGiven: successfulAsksToPlayer.length,
			cardsTaken: successfulAsksByPlayer.length,
			totalCalls: callsByPlayer.length,
			successfulCalls: successfulCalls.length,
			totalTransfers: transfersByPlayer.length
		} );
	}

	for ( const teamId of Object.keys( teams ) ) {
		metrics.team.push( {
			teamId,
			score: teams[ teamId ].score,
			setsWon: teams[ teamId ].setsWon.split( "," )
		} );
	}

	logger.debug( "<< getMetrics()" );
	return metrics;
}

export async function createGame( { playerCount }: CreateGameInput, { authInfo }: AuthContext ) {
	logger.debug( ">> createGame()" );

	const game = await repository.createGame( { playerCount, code: generateGameCode(), currentTurn: authInfo.id } );
	await repository.createPlayer( { ...authInfo, gameId: game.id } );

	logger.debug( "<< createGame()" );
	return game;
}

export async function joinGame( input: JoinGameInput, { authInfo }: AuthContext ) {
	logger.debug( ">> joinGame()" );

	const { game, isUserAlreadyInGame } = await validateJoinGame( input, authInfo );

	if ( isUserAlreadyInGame ) {
		return game;
	}

	const newPlayer = await repository.createPlayer( { ...authInfo, gameId: game.id } );

	if ( game.playerCount === game.players.length + 1 ) {
		await repository.updateGameStatus( game.id, "PLAYERS_READY" );
		await publishLiteratureEvent( game.id, LiteratureEvent.STATUS_UPDATED, "PLAYERS_READY" );
	}

	await publishLiteratureEvent( game.id, LiteratureEvent.PLAYER_JOINED, newPlayer );

	logger.debug( "<< joinGame()" );
	return game;
}

export async function addBots( { game, players }: Literature.Context ) {
	logger.debug( ">> addBots()" );
	const botData: Literature.PlayerData = {};

	const botCount = await validateAddBots( game, players );

	for ( let i = 0; i < botCount; i++ ) {
		const bot = await repository.createPlayer( { gameId: game.id, isBot: 1 } );
		botData[ bot.id ] = bot;
		await publishLiteratureEvent( game.id, LiteratureEvent.PLAYER_JOINED, bot );
	}

	await repository.updateGameStatus( game.id, "PLAYERS_READY" );
	await publishLiteratureEvent( game.id, LiteratureEvent.STATUS_UPDATED, "PLAYERS_READY" );

	logger.debug( "<< addBots()" );
	return botData;
}

export async function createTeams( input: CreateTeamsInput, { game, players }: Literature.Context ) {
	logger.debug( ">> createTeams()" );

	await validateCreateTeams( game, players );

	const teams = await repository.createTeams(
		Object.keys( input.data ).map( name => ( {
			name,
			memberIds: input.data[ name ].join( "," ),
			gameId: game.id
		} ) )
	);

	const teamData = teams.reduce(
		( acc, team ) => {
			acc[ team.id ] = team;
			return acc;
		},
		{} as Literature.TeamData
	);

	await repository.assignTeamsToPlayers( teamData );
	await repository.updateGameStatus( game.id, "TEAMS_CREATED" );

	await publishLiteratureEvent( game.id, LiteratureEvent.STATUS_UPDATED, "TEAMS_CREATED" );
	await publishLiteratureEvent( game.id, LiteratureEvent.TEAMS_CREATED, teamData );

	logger.debug( "<< createTeams()" );
	return teamData;
}

export async function startGame( { game, players }: Literature.Context ) {
	logger.debug( ">> startGame()" );

	await repository.updateGameStatus( game.id, "IN_PROGRESS" );

	const deck = removeCardsOfRank( generateDeck(), CardRank.SEVEN );

	const playerIds = Object.keys( players );
	const hands = generateHands( deck, game.playerCount );

	const cardLocations: Literature.CardLocation[] = [];
	const cardMappings: Literature.CardMapping[] = [];
	const cardCounts: Literature.CardCounts = {};

	playerIds.forEach( ( playerId, index ) => {
		const hand = hands[ index ];
		cardCounts[ playerId ] = 48 / game.playerCount;

		hand.forEach( card => {
			cardMappings.push( { cardId: getCardId( card ), playerId, gameId: game.id } );
		} );

		const otherPlayerIds = playerIds.filter( id => id !== playerId ).join( "," );

		const cardLocationsForPlayer = deck.map( c => {
			if ( isCardInHand( hand, c ) ) {
				return { gameId: game.id, cardId: getCardId( c ), playerId, playerIds: playerId, weight: 0 };
			}

			const weight = MAX_ASK_WEIGHT / otherPlayerIds.length;
			return { gameId: game.id, cardId: getCardId( c ), playerId, playerIds: otherPlayerIds, weight };
		} );

		cardLocations.push( ...cardLocationsForPlayer );
	} );

	await repository.createCardMappings( cardMappings );
	await repository.createCardLocations( cardLocations );

	await publishLiteratureEvent( game.id, LiteratureEvent.CARD_COUNT_UPDATED, cardCounts );
	logger.debug( "Published CardCountUpdatedEvent!" );

	let i = 0;
	for ( const playerId of playerIds ) {
		await publishLiteratureEvent( game.id, LiteratureEvent.CARDS_DEALT, hands[ i++ ], playerId );
	}

	await publishLiteratureEvent( game.id, LiteratureEvent.STATUS_UPDATED, "IN_PROGRESS" );
	logger.debug( "Published StatusUpdatedEvent!" );

	logger.debug( "<< startGame()" );
}

export async function askCard( input: AskCardInput, { game, players, cardCounts }: Literature.Context ) {
	logger.debug( ">> askCard()" );

	const { playerWithAskedCard, askedPlayer } = await validateAskCard( input, game, players );
	const askedCard = getCardFromId( input.card );
	const currentPlayer = players[ game.currentTurn ];

	const moveSuccess = askedPlayer.id === playerWithAskedCard.id ? 1 : 0;
	const receivedString = moveSuccess ? "got the card!" : "was declined!";
	const cardDisplayString = getCardDisplayString( askedCard );
	const description = `${ currentPlayer.name } asked ${ askedPlayer.name } for ${ cardDisplayString } and ${ receivedString }`;

	const ask = await repository.createAsk( {
		playerId: currentPlayer.id,
		gameId: game.id,
		success: moveSuccess,
		description,
		cardId: input.card,
		askedFrom: input.from
	} );

	const nextTurn = !ask.success ? ask.askedFrom : ask.playerId;
	if ( nextTurn !== game.currentTurn ) {
		await repository.updateCurrentTurn( game.id, nextTurn );
		await publishLiteratureEvent( game.id, LiteratureEvent.TURN_UPDATED, nextTurn );
		logger.debug( "Published TurnUpdatedEvent!" );
	}

	if ( ask.success ) {
		await repository.updateCardMapping( ask.cardId, game.id, ask.playerId );
		cardCounts[ ask.playerId ]++;
		cardCounts[ ask.askedFrom ]--;

		await publishLiteratureEvent( game.id, LiteratureEvent.CARD_COUNT_UPDATED, cardCounts );
		logger.debug( "Published CardCountUpdatedEvent!" );
	}

	const cardLocations = await repository.getCardLocationsForCard( game.id, ask.cardId ).then( cardLocations => {
		return cardLocations.map( ( { gameId, playerId, cardId, playerIds, weight } ) => {
			if ( ask.success ) {
				weight = ask.playerId === playerId ? 0 : MAX_ASK_WEIGHT;
				playerIds = ask.playerId;
			} else {
				playerIds = playerIds.split( "," ).filter( p => p !== ask.playerId && p !== ask.askedFrom ).join( "," );
				weight = MAX_ASK_WEIGHT / playerIds.length;
			}

			return { gameId, playerId, cardId, playerIds, weight };
		} );
	} );

	await repository.updateCardLocations( cardLocations );
	await repository.updateLastMove( game.id, ask.id );
	await publishLiteratureEvent( game.id, LiteratureEvent.CARD_ASKED, ask );

	logger.debug( "<< askCard()" );
}

export async function callSet( input: CallSetInput, { game, players, cardCounts, teams }: Literature.Context ) {
	logger.debug( ">> callSet()" );

	const { correctCall, calledSet } = await validateCallSet( input, game, players );
	const callingPlayer = players[ game.currentTurn ]!;

	let success = 1;
	let successString = "correctly!";

	for ( const card of cardSetMap[ calledSet ] ) {
		const cardId = getCardId( card );
		if ( correctCall[ cardId ] !== input.data[ cardId ] ) {
			success = 0;
			successString = "incorrectly!";
			break;
		}
	}

	const call = await repository.createCall( {
		gameId: game.id,
		playerId: callingPlayer.id,
		success,
		description: `${ callingPlayer.name } called ${ calledSet } ${ successString }`,
		cardSet: calledSet,
		actualCall: input.data,
		correctCall
	} );

	const calledCards = Object.keys( correctCall );
	await repository.deleteCardLocationForCards( game.id, calledCards );
	await repository.deleteCardMappings( game.id, calledCards );

	Object.values( correctCall ).forEach( playerId => {
		cardCounts[ playerId ]--;
	} );

	let winningTeamId = callingPlayer.teamId!;

	if ( !success ) {
		const [ player ] = Object.values( players ).filter( player => player.teamId !== winningTeamId );
		winningTeamId = player.teamId!;
	}

	await repository.updateTeamScore(
		winningTeamId,
		teams[ winningTeamId ].score++,
		teams[ winningTeamId ].setsWon.concat( "," + calledSet )
	);

	const setsCompleted: CardSet[] = [ calledSet ];
	Object.values( teams ).forEach( team => {
		setsCompleted.push( ...team.setsWon.split( "," ) as CardSet[] );
	} );

	const scoreUpdate = {
		teamId: teams[ winningTeamId ].id,
		score: teams[ winningTeamId ].score + 1,
		setWon: calledSet,
		isLastSet: setsCompleted.length === 8
	};

	await publishLiteratureEvent( game.id, LiteratureEvent.SCORE_UPDATED, scoreUpdate );
	logger.debug( "SetsCompleted: %o", setsCompleted );

	if ( scoreUpdate.isLastSet ) {
		await repository.updateGameStatus( game.id, "COMPLETED" );
		const metrics = await getMetrics( game, players, teams );
		await publishLiteratureEvent( game.id, LiteratureEvent.GAME_COMPLETED, metrics );

	} else {

		let nextTurn: string;
		const playersWithCards = shuffle( Object.values( players ) )
			.filter( player => cardCounts[ player.id ] !== 0 );

		const oppositeTeamPlayersWithCards = playersWithCards.filter( p => p.teamId !== callingPlayer.teamId );
		const teamPlayersWithCards = playersWithCards.filter( p => p.teamId === callingPlayer.teamId );

		if ( success ) {
			if ( cardCounts[ callingPlayer.id ] !== 0 ) {
				nextTurn = callingPlayer.id;
			} else {
				if ( teamPlayersWithCards.length !== 0 ) {
					nextTurn = teamPlayersWithCards[ 0 ].id;
				} else {
					nextTurn = oppositeTeamPlayersWithCards[ 0 ].id;
				}
			}
		} else {
			if ( oppositeTeamPlayersWithCards.length !== 0 ) {
				nextTurn = oppositeTeamPlayersWithCards[ 0 ].id;
			} else {
				if ( teamPlayersWithCards.length > 0 ) {
					nextTurn = teamPlayersWithCards[ 0 ].id;
				} else {
					nextTurn = callingPlayer.id;
				}
			}
		}

		if ( nextTurn !== game.currentTurn ) {
			await repository.updateCurrentTurn( game.id, nextTurn );
			await publishLiteratureEvent( game.id, LiteratureEvent.TURN_UPDATED, nextTurn );
			logger.debug( "Published TurnUpdatedEvent!" );
		}
	}

	await repository.updateLastMove( game.id, call.id );
	await publishLiteratureEvent( game.id, LiteratureEvent.SET_CALLED, call );
	await publishLiteratureEvent( game.id, LiteratureEvent.CARD_COUNT_UPDATED, cardCounts );

	logger.debug( "<< callSet()" );
}

export async function transferTurn( input: TransferTurnInput, { game, players, cardCounts }: Literature.Context ) {
	logger.debug( ">> transferTurn()" );

	const { transferringPlayer, receivingPlayer } = await validateTransferTurn(
		input, game, players, cardCounts
	);

	const transfer = await repository.createTransfer( {
		gameId: game.id,
		playerId: transferringPlayer.id,
		success: 1,
		description: `${ transferringPlayer.name } transferred the turn to ${ receivingPlayer.name }`,
		transferTo: input.transferTo
	} );

	await repository.updateCurrentTurn( game.id, input.transferTo );
	await repository.updateLastMove( game.id, transfer.id );
	await publishLiteratureEvent( game.id, LiteratureEvent.TURN_UPDATED, input.transferTo );
	logger.debug( "Published TurnUpdatedEvent!" );

	await publishLiteratureEvent( game.id, LiteratureEvent.TURN_TRANSFERRED, transfer );

	logger.debug( "<< transferTurn()" );
}

export async function executeBotMove( context: Literature.Context ) {
	logger.debug( ">> executeBotMove()" );

	const { game, players, cardCounts } = context;

	const cardMappings = await repository.getCardMappingsForPlayer( game.id, game.currentTurn );
	const cardLocations = await repository.getCardLocationsForPlayer( game.id, game.currentTurn );
	const lastCall = await repository.getCallMove( game.lastMoveId );
	const hand = cardMappings.map( mapping => getCardFromId( mapping.cardId ) );
	const cardSets = suggestCardSets( cardLocations, hand );

	if ( !!lastCall && lastCall.success && lastCall.playerId === game.currentTurn ) {
		logger.info( "Last Move was a successful call! Can transfer chance!" );
		const transfers = suggestTransfer( game, players, cardCounts );

		if ( transfers.length > 0 ) {

			await transferTurn( { transferTo: transfers[ 0 ].transferTo, gameId: game.id }, context );
			logger.debug( "<< executeBotMove()" );
			return;
		}
	}

	const calls = suggestCalls( game, players, cardCounts, cardSets, cardLocations, hand );

	if ( calls.length > 0 ) {

		await callSet( { gameId: game.id, data: calls[ 0 ].callData }, context );
		logger.debug( "<< executeBotMove()" );
		return;
	}

	const asks = suggestAsks( game, players, cardCounts, cardSets, cardLocations, hand );

	if ( asks.length === 0 ) {
		logger.error( "No Valid Move Found!" );
	}

	const [ bestAsk ] = asks;
	await askCard( { from: bestAsk.playerId, card: bestAsk.cardId, gameId: game.id }, context );

	logger.debug( "<< executeBotMove()" );
}

async function publishLiteratureEvent<E extends Literature.Event>(
	gameId: string,
	event: E,
	data: Literature.EventPayloads[E],
	playerId?: string
) {
	console.log( "literature", { gameId, event, data, playerId } );
}