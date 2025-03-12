import {
	CardRank,
	CardSet,
	cardSetMap,
	generateDeck,
	generateHands,
	getCardDisplayString,
	getCardFromId,
	getCardId,
	isCardInHand,
	removeCardsOfRank,
	shuffle
} from "@stairway/cards";
import { prisma } from "@stairway/prisma";
import type { Auth } from "@stairway/types/auth";
import type { Literature } from "@stairway/types/literature";
import { createLogger, generateAvatar, generateGameCode, generateName } from "@stairway/utils";
import { TRPCError } from "@trpc/server";
import { suggestAsks, suggestCalls, suggestCardSets, suggestTransfer } from "./bot.service";
import { publishGameEvent, publishPlayerEvent } from "./events";
import type {
	AskCardInput,
	CallSetInput,
	CreateGameInput,
	CreateTeamsInput,
	JoinGameInput,
	TransferTurnInput
} from "./inputs";
import {
	validateAddBots,
	validateAskCard,
	validateCallSet,
	validateCreateTeams,
	validateJoinGame,
	validateTransferTurn
} from "./validators";

const logger = createLogger( "LiteratureService" );
const MAX_ASK_WEIGHT = 720;

export async function getGameData( gameId: string ) {
	logger.debug( ">> getGameData()" );

	const data = await prisma.literature.game.findUnique( {
		where: { id: gameId },
		include: { players: true, teams: true }
	} );

	if ( !data ) {
		logger.error( "Game Not Found!" );
		throw new TRPCError( { code: "NOT_FOUND", message: "Game Not Found!" } );
	}

	const { players, teams, ...game } = data;
	const playerMap: Literature.PlayerData = {};
	players.forEach( player => {
		playerMap[ player.id ] = player;
	} );

	const teamMap: Literature.TeamData = {};
	teams.forEach( team => {
		teamMap[ team.id ] = team;
	} );

	logger.debug( "<< getGameData()" );
	return { game, players: playerMap, teams: teamMap };
}

export async function getCardCounts( gameId: string, players: Literature.PlayerData ) {
	logger.debug( ">> getCardCounts()" );

	const cardMappings = await prisma.literature.cardMapping.findMany( { where: { gameId } } );
	const cardCounts: Literature.CardCounts = {};

	Object.keys( players ).forEach( playerId => {
		cardCounts[ playerId ] = cardMappings.filter( mapping => mapping.playerId === playerId ).length;
	} );

	logger.debug( "<< getCardCounts()" );
	return cardCounts;
}

export async function getPlayerHand( gameId: string, playerId: string ) {
	logger.debug( ">> getPlayerHand()" );

	const cardMappings = await prisma.literature.cardMapping.findMany( { where: { gameId, playerId } } );
	const hand = cardMappings.map( mapping => getCardFromId( mapping.cardId ) );

	logger.debug( "<< getPlayerHand()" );
	return hand;
}

export async function getLastMoveData( lastMoveId: string ) {
	logger.debug( ">> getLastMove()" );

	const ask = await prisma.literature.ask.findUnique( { where: { id: lastMoveId } } );
	if ( !!ask ) {
		return { move: ask, isCall: false } as const;
	}

	const call = await prisma.literature.call.findUnique( { where: { id: lastMoveId } } );
	if ( !!call ) {
		return { move: call, isCall: true } as const;
	}

	const transfer = await prisma.literature.transfer.findUnique( { where: { id: lastMoveId } } );
	if ( !!transfer ) {
		return { move: transfer, isCall: false } as const;
	}

	return { move: undefined, isCall: false } as const;
}

export async function getPreviousAsks( gameId: string ) {
	logger.debug( ">> getPreviousAsks()" );
	const asks = await prisma.literature.ask.findMany( { where: { gameId }, take: 5, orderBy: { timestamp: "desc" } } );
	logger.debug( "<< getPreviousAsks()" );
	return asks.slice( 0, 5 );
}

export async function getMetrics( game: Literature.Game, players: Literature.PlayerData, teams: Literature.TeamData ) {
	logger.debug( ">> getMetrics()" );

	const asks = await prisma.literature.ask.findMany( { where: { gameId: game.id } } );
	const calls = await prisma.literature.call.findMany( { where: { gameId: game.id } } );
	const transfers = await prisma.literature.transfer.findMany( { where: { gameId: game.id } } );

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
			setsWon: teams[ teamId ].setsWon
		} );
	}

	logger.debug( "<< getMetrics()" );
	return metrics;
}

export async function createGame( { playerCount }: CreateGameInput, { id, name, avatar }: Auth.Info ) {
	logger.debug( ">> createGame()" );

	const game = await prisma.literature.game.create( {
		data: {
			playerCount,
			code: generateGameCode(),
			currentTurn: id,
			players: { create: { id, name, avatar } }
		}
	} );

	logger.debug( "<< createGame()" );
	return game;
}

export async function joinGame( input: JoinGameInput, authInfo: Auth.Info ) {
	logger.debug( ">> joinGame()" );

	const { game, isUserAlreadyInGame } = await validateJoinGame( input, authInfo );

	if ( isUserAlreadyInGame ) {
		return game;
	}

	const newPlayer = await prisma.literature.player.create( {
		data: { id: authInfo.id, name: authInfo.name, avatar: authInfo.avatar, gameId: game.id }
	} );

	if ( game.playerCount === game.players.length + 1 ) {
		await prisma.literature.game.update( {
			where: { id: game.id },
			data: { status: "PLAYERS_READY" }
		} );

		publishGameEvent( game.id, "status-updated", "PLAYERS_READY" );
	}

	publishGameEvent( game.id, "player-joined", newPlayer );

	logger.debug( "<< joinGame()" );
	return game;
}

export async function addBots( game: Literature.Game, players: Literature.PlayerData ) {
	logger.debug( ">> addBots()" );
	const botData: Literature.PlayerData = {};

	const botCount = await validateAddBots( game, players );

	for ( let i = 0; i < botCount; i++ ) {
		const name = generateName();
		const avatar = generateAvatar();
		const bot = await prisma.literature.player.create( { data: { name, avatar, gameId: game.id, isBot: true } } );

		botData[ bot.id ] = bot;
		publishGameEvent( game.id, "player-joined", bot );
	}

	await prisma.literature.game.update( {
		where: { id: game.id },
		data: { status: "PLAYERS_READY" }
	} );

	publishGameEvent( game.id, "status-updated", "PLAYERS_READY" );

	logger.debug( "<< addBots()" );
	return botData;
}

export async function createTeams( input: CreateTeamsInput, game: Literature.Game, players: Literature.PlayerData ) {
	logger.debug( ">> createTeams()" );

	await validateCreateTeams( game, players );

	const teamData: Literature.TeamData = {};
	for ( const name of Object.keys( input.data ) ) {
		const memberIds = input.data[ name ];
		const team = await prisma.literature.team.create( { data: { name, gameId: game.id, memberIds } } );
		await prisma.literature.player.updateMany( {
			where: { id: { in: memberIds } },
			data: { teamId: team.id }
		} );

		teamData[ team.id ] = team;
	}

	await prisma.literature.game.update( {
		where: { id: game.id },
		data: { status: "TEAMS_CREATED" }
	} );

	publishGameEvent( game.id, "status-updated", "TEAMS_CREATED" );
	publishGameEvent( game.id, "teams-created", teamData );

	logger.debug( "<< createTeams()" );
	return teamData;
}

export async function startGame( game: Literature.Game, players: Literature.PlayerData ) {
	logger.debug( ">> startGame()" );

	await prisma.literature.game.update( {
		where: { id: game.id },
		data: { status: "IN_PROGRESS" }
	} );

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

		const otherPlayerIds = playerIds.filter( id => id !== playerId );

		const cardLocationsForPlayer = deck.map( c => {
			if ( isCardInHand( hand, c ) ) {
				return { gameId: game.id, cardId: getCardId( c ), playerId, playerIds: [ playerId ], weight: 0 };
			}

			const weight = MAX_ASK_WEIGHT / otherPlayerIds.length;
			return { gameId: game.id, cardId: getCardId( c ), playerId, playerIds: otherPlayerIds, weight };
		} );

		cardLocations.push( ...cardLocationsForPlayer );
	} );

	await prisma.literature.cardMapping.createMany( { data: cardMappings } );
	await prisma.literature.cardLocation.createMany( { data: cardLocations } );

	publishGameEvent( game.id, "card-count-updated", cardCounts );
	logger.debug( "Published CardCountUpdatedEvent!" );

	playerIds.forEach( ( playerId, index ) => {
		publishPlayerEvent( game.id, playerId, "cards-dealt", hands[ index ] );
	} );

	publishGameEvent( game.id, "status-updated", "IN_PROGRESS" );
	logger.debug( "Published StatusUpdatedEvent!" );

	logger.debug( "<< startGame()" );
}

export async function askCard(
	input: AskCardInput,
	game: Literature.Game,
	players: Literature.PlayerData,
	cardCounts: Literature.CardCounts
) {
	logger.debug( ">> askCard()" );

	const { playerWithAskedCard, askedPlayer } = await validateAskCard( input, game, players );
	const askedCard = getCardFromId( input.card );
	const currentPlayer = players[ game.currentTurn ];

	const moveSuccess = askedPlayer.id === playerWithAskedCard.id;
	const receivedString = moveSuccess ? "got the card!" : "was declined!";
	const cardDisplayString = getCardDisplayString( askedCard );
	const description = `${ currentPlayer.name } asked ${ askedPlayer.name } for ${ cardDisplayString } and ${ receivedString }`;

	const ask = await prisma.literature.ask.create( {
		data: {
			playerId: currentPlayer.id,
			gameId: game.id,
			success: moveSuccess,
			description,
			cardId: input.card,
			askedFrom: input.from
		}
	} );

	const nextTurn = !ask.success ? ask.askedFrom : ask.playerId;
	if ( nextTurn !== game.currentTurn ) {
		await prisma.literature.game.update( {
			where: { id: game.id },
			data: { currentTurn: nextTurn }
		} );

		publishGameEvent( game.id, "turn-updated", nextTurn );
		logger.debug( "Published TurnUpdatedEvent!" );
	}

	if ( ask.success ) {
		await prisma.literature.cardMapping.update( {
			where: { gameId_cardId: { gameId: ask.gameId, cardId: ask.cardId } },
			data: { playerId: ask.playerId }
		} );

		cardCounts[ ask.playerId ]++;
		cardCounts[ ask.askedFrom ]--;

		publishGameEvent( game.id, "card-count-updated", cardCounts );
		logger.debug( "Published CardCountUpdatedEvent!" );
	}

	const cardLocations = await prisma.literature.cardLocation.findMany( {
		where: {
			gameId: game.id,
			cardId: ask.cardId
		}
	} );

	for ( let { gameId, playerId, cardId, playerIds, weight } of cardLocations ) {
		if ( ask.success ) {
			weight = ask.playerId === playerId ? 0 : MAX_ASK_WEIGHT;
			playerIds = [ ask.playerId ];
		} else {
			playerIds = playerIds.filter( p => p !== ask.playerId && p !== ask.askedFrom );
			weight = MAX_ASK_WEIGHT / playerIds.length;
		}

		await prisma.literature.cardLocation.update( {
			where: { gameId_playerId_cardId: { gameId, playerId, cardId } },
			data: { playerIds, weight }
		} );
	}

	await prisma.literature.game.update( {
		where: { id: game.id },
		data: { lastMoveId: ask.id }
	} );

	publishGameEvent( game.id, "card-asked", ask );

	logger.debug( "<< askCard()" );
}

export async function callSet(
	input: CallSetInput,
	game: Literature.Game,
	players: Literature.PlayerData,
	teams: Literature.TeamData,
	cardCounts: Literature.CardCounts
) {
	logger.debug( ">> callSet()" );

	const { correctCall, calledSet } = await validateCallSet( input, game, players );
	const callingPlayer = players[ game.currentTurn ]!;

	let success = true;
	let successString = "correctly!";

	for ( const card of cardSetMap[ calledSet ] ) {
		const cardId = getCardId( card );
		if ( correctCall[ cardId ] !== input.data[ cardId ] ) {
			success = false;
			successString = "incorrectly!";
			break;
		}
	}

	const call = await prisma.literature.call.create( {
		data: {
			gameId: game.id,
			playerId: callingPlayer.id,
			success,
			description: `${ callingPlayer.name } called ${ calledSet } ${ successString }`,
			cardSet: calledSet,
			actualCall: input.data,
			correctCall
		}
	} );

	const calledCards = Object.keys( correctCall );
	await prisma.literature.cardMapping.deleteMany( { where: { gameId: game.id, cardId: { in: calledCards } } } );
	await prisma.literature.cardLocation.deleteMany( { where: { gameId: game.id, cardId: { in: calledCards } } } );

	Object.values( correctCall ).forEach( playerId => {
		cardCounts[ playerId ]--;
	} );

	let winningTeamId = callingPlayer.teamId!;

	if ( !success ) {
		const [ player ] = Object.values( players ).filter( player => player.teamId !== winningTeamId );
		winningTeamId = player.teamId!;
	}

	await prisma.literature.team.update( {
		where: { id: winningTeamId },
		data: {
			score: { increment: 1 },
			setsWon: { push: calledSet }
		}
	} );

	const setsCompleted: CardSet[] = [ calledSet ];
	Object.values( teams ).forEach( team => {
		setsCompleted.push( ...team.setsWon as CardSet[] );
	} );

	const scoreUpdate = {
		teamId: teams[ winningTeamId ].id,
		score: teams[ winningTeamId ].score + 1,
		setWon: calledSet,
		isLastSet: setsCompleted.length === 8
	};

	publishGameEvent( game.id, "score-updated", scoreUpdate );
	logger.debug( "SetsCompleted: %o", setsCompleted );

	if ( scoreUpdate.isLastSet ) {
		await prisma.literature.game.update( {
			where: { id: game.id },
			data: { status: "COMPLETED" }
		} );

		const metrics = await getMetrics( game, players, teams );
		publishGameEvent( game.id, "game-completed", metrics );

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
				nextTurn = callingPlayer.id;
			}
		}

		if ( nextTurn !== game.currentTurn ) {
			await prisma.literature.game.update( {
				where: { id: game.id },
				data: { currentTurn: nextTurn }
			} );

			publishGameEvent( game.id, "turn-updated", nextTurn );
			logger.debug( "Published TurnUpdatedEvent!" );
		}
	}

	await prisma.literature.game.update( {
		where: { id: game.id },
		data: { lastMoveId: call.id }
	} );

	publishGameEvent( game.id, "set-called", call );
	publishGameEvent( game.id, "card-count-updated", cardCounts );

	logger.debug( "<< callSet()" );
}

export async function transferTurn(
	input: TransferTurnInput,
	game: Literature.Game,
	players: Literature.PlayerData,
	cardCounts: Literature.CardCounts
) {
	logger.debug( ">> transferTurn()" );

	const { transferringPlayer, receivingPlayer } = await validateTransferTurn(
		input, game, players, cardCounts
	);

	const transfer = await prisma.literature.transfer.create( {
		data: {
			gameId: game.id,
			playerId: transferringPlayer.id,
			success: true,
			description: `${ transferringPlayer.name } transferred the turn to ${ receivingPlayer.name }`,
			transferTo: input.transferTo
		}
	} );

	await prisma.literature.game.update( {
		where: { id: game.id },
		data: { currentTurn: input.transferTo, lastMoveId: transfer.id }
	} );

	publishGameEvent( game.id, "turn-updated", input.transferTo );
	logger.debug( "Published TurnUpdatedEvent!" );

	publishGameEvent( game.id, "turn-transferred", transfer );

	logger.debug( "<< transferTurn()" );
}

export async function executeBotMove(
	game: Literature.Game,
	players: Literature.PlayerData,
	teams: Literature.TeamData,
	cardCounts: Literature.CardCounts
) {
	logger.debug( ">> executeBotMove()" );

	const { cardLocations, cardMappings } = await prisma.literature.player.findUniqueOrThrow( {
		where: { id_gameId: { id: game.currentTurn, gameId: game.id } },
		include: { cardLocations: true, cardMappings: true }
	} );

	const lastCall = await prisma.literature.call.findFirst( { where: { id: game.lastMoveId } } );
	const hand = cardMappings.map( mapping => getCardFromId( mapping.cardId ) );
	const cardSets = suggestCardSets( cardLocations, hand );

	if ( !!lastCall && lastCall.success && lastCall.playerId === game.currentTurn ) {
		logger.info( "Last Move was a successful call! Can transfer chance!" );
		const transfers = suggestTransfer( game, players, cardCounts );

		if ( transfers.length > 0 ) {

			await transferTurn( { transferTo: transfers[ 0 ].transferTo, gameId: game.id }, game, players, cardCounts );
			logger.debug( "<< executeBotMove()" );
			return;
		}
	}

	const calls = suggestCalls( game, players, cardCounts, cardSets, cardLocations, hand );

	if ( calls.length > 0 ) {

		await callSet( { gameId: game.id, data: calls[ 0 ].callData }, game, players, teams, cardCounts );
		logger.debug( "<< executeBotMove()" );
		return;
	}

	const asks = suggestAsks( game, players, cardCounts, cardSets, cardLocations, hand );

	if ( asks.length === 0 ) {
		logger.error( "No Valid Move Found!" );
	}

	const [ bestAsk ] = asks;
	await askCard( { from: bestAsk.playerId, card: bestAsk.cardId, gameId: game.id }, game, players, cardCounts );

	logger.debug( "<< executeBotMove()" );
}