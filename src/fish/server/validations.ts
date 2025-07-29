import type { CardId } from "@/libs/cards/types";
import { isCardInHand } from "@/libs/cards/utils";
import { GAME_STATUS } from "@/libs/fish/constants";
import type {
	AskEventInput,
	ClaimEventInput,
	CreateTeamsInput,
	FishGameData,
	TransferEventInput
} from "@/libs/fish/types";
import { getBookForCard } from "@/libs/fish/utils";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger( "Fish:Validations" );

export function validateGameData( data: FishGameData, playerId: string ) {
	if ( !data || !data.players[ playerId ] ) {
		logger.error( "Game not found! GameId: %s", data.id );
		throw "Game not found!";
	}

	const currentPlayer = data.players[ data.currentTurn ];
	if ( !currentPlayer || currentPlayer.id !== playerId ) {
		logger.error( "Not your turn! GameId: %s, PlayerId: %s", data.id, playerId );
		throw "Not your turn!";
	}
}

export function validateAddPlayer( data: FishGameData, playerId: string ) {
	logger.debug( ">> validateAddPlayer()" );

	if ( data.players[ playerId ] ) {
		return true;
	}

	if ( data.status !== GAME_STATUS.CREATED ) {
		logger.error( "The Game is not in CREATED state! GameId: %s", data.id );
		throw "The Game is not in CREATED state!";
	}

	if ( data.playerIds.length === data.config.playerCount ) {
		logger.error( "The Game already has required players! GameId: %s", data.id );
		throw "The Game already has required players!";
	}

	logger.debug( "<< validateAddPlayer()" );
	return false;
}

export function validateCreateTeams( input: CreateTeamsInput, data: FishGameData, playerId: string ) {
	logger.debug( ">> validateCreateTeams()" );
	validateGameData( data, playerId );

	if ( data.status !== GAME_STATUS.PLAYERS_READY ) {
		logger.error( "The Game is not in PLAYERS_READY state! GameId: %s", data.id );
		throw "The Game is not in PLAYERS_READY state!";
	}

	if ( data.playerIds.length !== data.config.playerCount ) {
		logger.error( "The Game does not have required players! GameId: %s", data.id );
		throw "The Game does not have required players!";
	}

	if ( Object.keys( input.data ).length !== data.config.teamCount ) {
		logger.error( "The number of teams does not match the required count! GameId: %s", data.id );
		throw "The number of teams does not match the required count!";
	}

	const playersSpecified = new Set( Object.values( input.data ).flat() );
	if ( playersSpecified.size !== data.config.playerCount ) {
		logger.error( "Not all players are divided into teams! GameId: %s", data.id );
		throw "Not all players are divided into teams!";
	}

	const playersPerTeam = data.config.playerCount / data.config.teamCount;
	for ( const [ teamId, playerIds ] of Object.entries( input.data ) ) {
		if ( playerIds.length !== playersPerTeam ) {
			logger.error(
				"The number of players in team does not match the required count! GameId: %s",
				data.id
			);
			throw `The number of players in team ${ teamId } does not match the required count!`;
		}

		for ( const playerId of playerIds ) {
			if ( !data.players[ playerId ] ) {
				logger.error( "Player %s is not part of the game! GameId: %s", playerId, data.id );
				throw `Player ${ playerId } is not part of the game!`;
			}
		}
	}

	logger.debug( "<< validateCreateTeams()" );
}

export function validateStartGame( data: FishGameData, playerId: string ) {
	logger.debug( ">> validateStartGame()" );
	validateGameData( data, playerId );

	if ( data.status !== GAME_STATUS.TEAMS_CREATED ) {
		logger.error( "The Game is not in TEAMS_CREATED state! GameId: %s", data.id );
		throw "The Game is not in TEAMS_CREATED state!";
	}

	logger.debug( "<< validateStartGame()" );
}

export function validateAskEvent( event: AskEventInput, data: FishGameData, playerId: string ) {
	logger.debug( ">> validateAskEvent()" );

	validateGameData( data, playerId );
	const currentPlayerHand = data.hands[ data.currentTurn ];

	if ( data.status !== GAME_STATUS.IN_PROGRESS ) {
		logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", data.id );
		throw "The Game is not in IN_PROGRESS state!";
	}

	if ( !data.players[ event.askedFrom ] ) {
		logger.error( "Asked player %s is not part of the game! GameId: %s", event.askedFrom, data.id );
		throw `Asked player ${ event.askedFrom } is not part of the game!`;
	}

	const book = getBookForCard( event.cardId, data.config.type );
	if ( !data.bookStates[ book ] ) {
		logger.error( "Card %s does not exist in the game! GameId: %s", event.cardId, data.id );
		throw `Card ${ event.cardId } does not exist in the game!`;
	}

	if ( isCardInHand( currentPlayerHand, event.cardId ) ) {
		logger.debug( "The asked card is with asking player itself! GameId: %s", data.id );
		throw "The asked card is with asking player itself!";
	}

	const askingPlayerTeam = data.teams[ data.players[ playerId ].teamId ];
	const askedPlayerTeam = data.teams[ data.players[ event.askedFrom ].teamId ];
	if ( askedPlayerTeam === askingPlayerTeam ) {
		logger.debug( "The asked player is from the same team! GameId: %s", data.id );
		throw "The asked player is from the same team!";
	}

	logger.debug( "<< validateAskEvent()" );
}

export function validateClaimEvent( event: ClaimEventInput, data: FishGameData, playerId: string ) {
	logger.debug( ">> validateDeclareBookEvent()" );
	validateGameData( data, playerId );

	if ( data.status !== GAME_STATUS.IN_PROGRESS ) {
		logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", data.id );
		throw "The Game is not in IN_PROGRESS state!";
	}

	const calledCards = Object.keys( event.claim ).map( key => key as CardId );

	if ( data.config.type === "NORMAL" && calledCards.length !== 4 ) {
		logger.error( "Normal Fish requires exactly 4 cards to be declared! GameId: %s", data.id );
		throw "Normal Fish requires exactly 4 cards to be declared!";
	}

	if ( data.config.type === "CANADIAN" && calledCards.length !== 6 ) {
		logger.error( "Canadian Fish requires exactly 6 cards to be declared! GameId: %s", data.id );
		throw "Canadian Fish requires exactly 6 cards to be declared!";
	}

	const calledPlayers = Array.from( new Set( Object.values( event.claim ) ) ).map( playerId => {
		const player = data.players[ playerId ];
		if ( !player ) {
			logger.error(
				"The Player is not part of the Game! GameId: %s, PlayerId: %s",
				data.id,
				playerId
			);
			throw "The Player is not part of the Game!";
		}
		return player;
	} );

	if ( !Object.values( event.claim ).includes( playerId ) ) {
		logger.error( "Calling Player did not call own cards! UserId: %s", playerId );
		throw "Calling Player did not call own cards!";
	}

	const calledBooks = calledCards.map( cardId => getBookForCard( cardId, data.config.type ) );
	if ( calledBooks.length !== 1 ) {
		logger.error( "Cards Called from multiple books! UserId: %s", data.currentTurn );
		throw "Cards Called from multiple books!";
	}

	const calledTeams = new Set( calledPlayers.map( player => player.teamId ) );
	if ( calledTeams.size !== 1 ) {
		logger.error( "Set called from multiple teams! UserId: %s", data.currentTurn );
		throw "Set called from multiple teams!";
	}

	logger.debug( "<< validateDeclareBookEvent()" );
}

export function validateTransferTurn( event: TransferEventInput, data: FishGameData, playerId: string ) {
	logger.debug( ">> validateTransferTurnRequest()" );
	validateGameData( data, playerId );

	if ( data.status !== GAME_STATUS.IN_PROGRESS ) {
		logger.error( "The Game is not in IN_PROGRESS state! GameId: %s", data.id );
		throw "The Game is not in IN_PROGRESS state!";
	}

	const lastClaim = data.claimHistory[ 0 ];
	if ( data.lastMoveType !== "claim" || !lastClaim || !lastClaim.success ) {
		logger.error( "Turn can only be transferred after a successful call!" );
		throw "Turn can only be transferred after a successful call!";
	}

	const transferringPlayer = data.players[ data.currentTurn ];
	const receivingPlayer = data.players[ event.transferTo ];

	if ( !receivingPlayer ) {
		logger.error( "The Receiving Player is not part of the Game!" );
		throw "The Receiving Player is not part of the Game!";
	}

	if ( data.cardCounts[ event.transferTo ] === 0 ) {
		logger.error( "Turn can only be transferred to a player with cards!" );
		throw "Turn can only be transferred to a player with cards!";
	}

	if ( receivingPlayer.teamId !== transferringPlayer.teamId ) {
		logger.error( "Turn can only be transferred to member of your team!" );
		throw "Turn can only be transferred to member of your team!";
	}

	logger.debug( "<< validateTransferTurnRequest()" );
}
