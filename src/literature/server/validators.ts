import type { AuthInfo } from "@/auth/types";
import type { CardId } from "@/libs/cards/types";
import { getCardFromId, getCardSet } from "@/libs/cards/utils";
import type { AskCardInput, CallSetInput, TransferTurnInput } from "@/literature/server/inputs";
import type { Literature } from "@/literature/types";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger( "LiteratureValidations" );

export async function validateJoinGame( data: Literature.GameData, authInfo: AuthInfo ) {
	logger.debug( ">> validateJoinGame()" );

	const isUserAlreadyInGame = !!Object.values( data.players ).find( player => player.id === authInfo.id );
	if ( isUserAlreadyInGame ) {
		logger.warn( "The User is already part of the Game! GameId: %s", data.game.id );
		return { isUserAlreadyInGame };
	}

	if ( Object.keys( data.players ).length >= data.game.playerCount ) {
		logger.error( "The Game already has required players! GameId: %s", data.game.id );
		throw "The Game already has required players!";
	}

	logger.debug( "<< validateJoinGame()" );
	return { game: data, isUserAlreadyInGame };
}

export async function validateAddBots( data: Literature.GameData ) {
	logger.debug( ">> validateAddBotsRequest()" );

	const remainingPlayers = data.game.playerCount - Object.keys( data.players ).length;

	if ( remainingPlayers <= 0 ) {
		logger.error( "The Game already has required players! GameId: %s", data.game.id );
		throw "The Game already has required players!";
	}

	logger.debug( "<< validateAddBotsRequest()" );
	return remainingPlayers;
}

export async function validateCreateTeams( data: Literature.GameData ) {
	logger.debug( ">> validateCreateTeamsRequest()" );

	if ( Object.keys( data.players ).length !== data.game.playerCount ) {
		logger.error( "The Game doesn't have enough players! GameId: %s", data.game.id );
		throw "The Game doesn't have enough players!";
	}

	logger.debug( "<< validateCreateTeamsRequest()" );
}

export async function validateAskCard( input: AskCardInput, data: Literature.GameData ) {
	logger.debug( ">> validateAskCardRequest()" );

	if ( !Object.keys( data.cardMappings ).includes( input.card ) ) {
		logger.error( "Card Not Part of Game! GameId: %s CardId: %s", data.game.id, input.card );
		throw "Card Not Part of Game!";
	}

	const askedPlayer = data.players[ input.from ];
	const playerWithAskedCard = data.players[ data.cardMappings[ input.card ] ];

	if ( !askedPlayer ) {
		logger.debug( "The Player is not part of the Game! GameId: %s, PlayerId: %s", data.game.id, input.from );
		throw "The Player is not part of the Game!";
	}

	if ( playerWithAskedCard.id === data.game.currentTurn ) {
		logger.debug( "The asked card is with asking player itself! GameId: %s", data.game.id );
		throw "The asked card is with asking player itself!";
	}

	if ( data.players[ data.game.currentTurn ].teamId === askedPlayer.teamId ) {
		logger.debug( "The asked player is from the same team! GameId: %s", data.game.id );
		throw "The asked player is from the same team!";
	}

	logger.debug( "<< validateAskCardRequest()" );
	return { askedPlayer, playerWithAskedCard };
}

export async function validateCallSet( input: CallSetInput, data: Literature.GameData ) {
	logger.debug( ">> validateCallSetRequest()" );

	const calledCards = Object.keys( input.data ).map( key => key as CardId ).map( getCardFromId );
	const cardSets = new Set( calledCards.map( getCardSet ) );

	const calledPlayers = Array.from( new Set( Object.values( input.data ) ) ).map( playerId => {
		const player = data.players[ playerId ];
		if ( !player ) {
			logger.error( "The Player is not part of the Game! GameId: %s, PlayerId: %s", data.game.id, playerId );
			throw "The Player is not part of the Game!";
		}
		return player;
	} );

	if ( !Object.values( input.data ).includes( data.game.currentTurn ) ) {
		logger.error( "Calling Player did not call own cards! UserId: %s", data.game.currentTurn );
		throw "Calling Player did not call own cards!";
	}

	if ( cardSets.size !== 1 ) {
		logger.error( "Cards Called from multiple sets! UserId: %s", data.game.currentTurn );
		throw "Cards Called from multiple sets!";
	}

	const [ calledSet ] = cardSets;
	let isCardSetWithCallingPlayer = false;

	const correctCall = Object.keys( input.data ).map( key => key as CardId ).reduce( ( acc, cardId ) => {
		const playerId = data.cardMappings[ cardId ];
		if ( playerId === data.game.currentTurn ) {
			isCardSetWithCallingPlayer = true;
		}
		acc[ cardId ] = playerId;
		return acc;
	}, {} as Record<CardId, string> );

	if ( !isCardSetWithCallingPlayer ) {
		logger.error( "Set called without cards from that set! UserId: %s, Set: %s", data.game.currentTurn, calledSet );
		throw "Set called without cards from that set!";
	}

	const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );

	if ( calledTeams.size !== 1 ) {
		logger.error( "Set called from multiple teams! UserId: %s", data.game.currentTurn );
		throw "Set called from multiple teams!";
	}

	if ( calledCards.length !== 6 ) {
		logger.error( "All Cards not called for the set! UserId: %s, Set: %s", data.game.currentTurn, calledSet );
		throw "All Cards not called for the set!";
	}

	logger.debug( "<< validateCallSetRequest()" );
	return { correctCall, calledSet };
}

export async function validateTransferTurn( input: TransferTurnInput, data: Literature.GameData ) {
	logger.debug( ">> validateTransferTurnRequest()" );

	if ( !data.lastCall ) {
		logger.error( "Turn can only be transferred after a successful call!" );
		throw "Turn can only be transferred after a successful call!";
	}

	const transferringPlayer = data.players[ data.game.currentTurn ];
	const receivingPlayer = data.players[ input.transferTo ];

	if ( !receivingPlayer ) {
		logger.error( "The Receiving Player is not part of the Game!" );
		throw "The Receiving Player is not part of the Game!";
	}

	if ( data.players[ input.transferTo ].cardCount === 0 ) {
		logger.error( "Turn can only be transferred to a player with cards!" );
		throw "Turn can only be transferred to a player with cards!";
	}

	if ( receivingPlayer.teamId !== transferringPlayer.teamId ) {
		logger.error( "Turn can only be transferred to member of your team!" );
		throw "Turn can only be transferred to member of your team!";
	}

	logger.debug( "<< validateTransferTurnRequest()" );
	return { transferringPlayer, receivingPlayer };
}