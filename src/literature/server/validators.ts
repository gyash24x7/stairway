import type { AuthInfo } from "@/auth/types";
import { getCardFromId, getCardSet } from "@/shared/cards/card";
import type { AskCardInput, CallSetInput, JoinGameInput, TransferTurnInput } from "@/literature/server/inputs";
import type { Literature } from "@/literature/types";
import { createLogger } from "@/shared/utils/logger";
import { prisma } from "@/shared/utils/prisma";
import { ORPCError } from "@orpc/server";

const logger = createLogger( "LiteratureValidations" );

export async function validateJoinGame( input: JoinGameInput, authInfo: AuthInfo ) {
	logger.debug( ">> validateJoinGame()" );
	const game = await prisma.literature.game.findUnique( {
		where: { code: input.code },
		include: { players: true }
	} );

	if ( !game ) {
		logger.error( "Game Not Found!" );
		throw new ORPCError( "NOT_FOUND", { message: "Game Not Found!" } );
	}

	logger.debug( "Found Game: %o", game.players.length );

	const isUserAlreadyInGame = !!game.players.find( player => player.id === authInfo.id );

	if ( isUserAlreadyInGame ) {
		logger.warn( "The User is already part of the Game! GameId: %s", game.id );
		return { game, isUserAlreadyInGame };
	}

	if ( game.players.length >= game.playerCount ) {
		logger.error( "The Game already has required players! GameId: %s", game.id );
		throw new ORPCError( "BAD_REQUEST", { message: "The Game already has required players!" } );
	}

	logger.debug( "<< validateJoinGame()" );
	return { game, isUserAlreadyInGame };
}

export async function validateAddBots( game: Literature.Game, players: Literature.PlayerData ) {
	logger.debug( ">> validateAddBotsRequest()" );

	const remainingPlayers = game.playerCount - Object.keys( players ).length;

	if ( remainingPlayers <= 0 ) {
		logger.error( "The Game already has required players! GameId: %s", game.id );
		throw new ORPCError( "BAD_REQUEST", { message: "The Game already has required players!" } );
	}

	logger.debug( "<< validateAddBotsRequest()" );
	return remainingPlayers;
}

export async function validateCreateTeams( game: Literature.Game, players: Literature.PlayerData ) {
	logger.debug( ">> validateCreateTeamsRequest()" );

	if ( Object.keys( players ).length !== game.playerCount ) {
		logger.error( "The Game doesn't have enough players! GameId: %s", game.id );
		throw new ORPCError( "BAD_REQUEST", { message: "The Game doesn't have enough players!" } );
	}

	logger.debug( "<< validateCreateTeamsRequest()" );
}

export async function validateAskCard( input: AskCardInput, game: Literature.Game, players: Literature.PlayerData ) {
	logger.debug( ">> validateAskCardRequest()" );

	const cardMapping = await prisma.literature.cardMapping.findUnique( {
		where: { gameId_cardId: { gameId: game.id, cardId: input.card } }
	} );

	if ( !cardMapping ) {
		logger.error( "Card Not Part of Game! GameId: %s CardId: %s", game.id, input.card );
		throw new ORPCError( "BAD_REQUEST", { message: "Card Not Part of Game!" } );
	}

	const askedPlayer = players[ input.from ];
	const playerWithAskedCard = players[ cardMapping.playerId ];

	if ( !askedPlayer ) {
		logger.debug( "The Player is not part of the Game! GameId: %s, PlayerId: %s", game.id, input.from );
		throw new ORPCError( "BAD_REQUEST", { message: "The Player is not part of the Game!" } );
	}

	if ( playerWithAskedCard.id === game.currentTurn ) {
		logger.debug( "The asked card is with asking player itself! GameId: %s", game.id );
		throw new ORPCError( "BAD_REQUEST", { message: "The asked card is with asking player itself!" } );
	}

	if ( players[ game.currentTurn ].teamId === askedPlayer.teamId ) {
		logger.debug( "The asked player is from the same team! GameId: %s", game.id );
		throw new ORPCError( "BAD_REQUEST", { message: "The asked player is from the same team!" } );
	}

	logger.debug( "<< validateAskCardRequest()" );
	return { askedPlayer, playerWithAskedCard };
}

export async function validateCallSet( input: CallSetInput, game: Literature.Game, players: Literature.PlayerData ) {
	logger.debug( ">> validateCallSetRequest()" );

	const cardMappings = await prisma.literature.cardMapping.findMany( {
		where: { gameId: game.id, cardId: { in: Object.keys( input.data ) } }
	} );

	const calledCards = Object.keys( input.data ).map( getCardFromId );
	const cardSets = new Set( calledCards.map( getCardSet ) );

	const calledPlayers = Array.from( new Set( Object.values( input.data ) ) ).map( playerId => {
		const player = players[ playerId ];
		if ( !player ) {
			logger.error( "The Player is not part of the Game! GameId: %s, PlayerId: %s", game.id, playerId );
			throw new ORPCError( "BAD_REQUEST", { message: "The Player is not part of the Game!" } );
		}
		return player;
	} );

	if ( !Object.values( input.data ).includes( game.currentTurn ) ) {
		logger.error( "Calling Player did not call own cards! UserId: %s", game.currentTurn );
		throw new ORPCError( "BAD_REQUEST", { message: "Calling Player did not call own cards!" } );
	}

	if ( cardSets.size !== 1 ) {
		logger.error( "Cards Called from multiple sets! UserId: %s", game.currentTurn );
		throw new ORPCError( "BAD_REQUEST", { message: "Cards Called from multiple sets!" } );
	}

	const [ calledSet ] = cardSets;
	const correctCall: Record<string, string> = {};
	let isCardSetWithCallingPlayer = false;

	cardMappings.forEach( ( { cardId, playerId } ) => {
		const card = getCardFromId( cardId );
		if ( getCardSet( card ) === calledSet ) {
			correctCall[ cardId ] = playerId;
			if ( playerId === game.currentTurn ) {
				isCardSetWithCallingPlayer = true;
			}
		}
	} );

	if ( !isCardSetWithCallingPlayer ) {
		logger.error( "Set called without cards from that set! UserId: %s, Set: %s", game.currentTurn, calledSet );
		throw new ORPCError( "BAD_REQUEST", { message: "Set called without cards from that set!" } );
	}

	const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

	if ( calledTeams.size !== 1 ) {
		logger.error( "Set called from multiple teams! UserId: %s", game.currentTurn );
		throw new ORPCError( "BAD_REQUEST", { message: "Set called from multiple teams!" } );
	}

	if ( calledCards.length !== 6 ) {
		logger.error( "All Cards not called for the set! UserId: %s, Set: %s", game.currentTurn, calledSet );
		throw new ORPCError( "BAD_REQUEST", { message: "All Cards not called for the set!" } );
	}

	logger.debug( "<< validateCallSetRequest()" );
	return { correctCall, calledSet };
}

export async function validateTransferTurn(
	input: TransferTurnInput,
	game: Literature.Game,
	players: Literature.PlayerData,
	cardCounts: Literature.CardCounts
) {
	logger.debug( ">> validateTransferTurnRequest()" );

	const lastMove = await prisma.literature.call.findUnique( { where: { id: game.lastMoveId } } );
	if ( !lastMove ) {
		logger.error( "Turn can only be transferred after a successful call!" );
		throw new ORPCError( "BAD_REQUEST", { message: "Turn can only be transferred after a successful call!" } );
	}

	const transferringPlayer = players[ game.currentTurn ];
	const receivingPlayer = players[ input.transferTo ];

	if ( !receivingPlayer ) {
		logger.error( "The Receiving Player is not part of the Game!" );
		throw new ORPCError( "BAD_REQUEST", { message: "The Receiving Player is not part of the Game!" } );
	}

	if ( cardCounts[ input.transferTo ] === 0 ) {
		logger.error( "Turn can only be transferred to a player with cards!" );
		throw new ORPCError( "BAD_REQUEST", { message: "Turn can only be transferred to a player with cards!" } );
	}

	if ( receivingPlayer.teamId !== transferringPlayer.teamId ) {
		logger.error( "Turn can only be transferred to member of your team!" );
		throw new ORPCError( "BAD_REQUEST", { message: "Turn can only be transferred to member of your team!" } );
	}

	logger.debug( "<< validateTransferTurnRequest()" );
	return { transferringPlayer, receivingPlayer };
}