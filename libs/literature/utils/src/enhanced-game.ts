import { CardDeck, CardHand, CardRank, CardSet, cardSetMap, ICardHand, PlayingCard } from "@s2h/cards";
import { ILiteratureMove, LiteratureMove, LiteratureMoveActionData, LiteratureMoveResultData } from "./enhanced-move";
import { ILiteraturePlayer, LiteraturePlayer } from "./enhanced-player";
import { ILiteratureTeam, LiteratureTeam } from "./enhanced-team";

export interface ILiteratureGame {
	id: string;
	code: string;
	playerCount: number;
	createdBy: string;
	createdTimestamp: string;
	status: LiteratureGameStatus;
	players: Record<string, ILiteraturePlayer>;
	teams: Record<string, ILiteratureTeam>;
	hands: Record<string, ICardHand>;
	moves: ILiteratureMove[];
	currentTurn: string;
}

export enum LiteratureGameStatus {
	CREATED = "CREATED",
	PLAYERS_READY = "PLAYERS_READY",
	TEAMS_CREATED = "TEAMS_CREATED",
	IN_PROGRESS = "IN_PROGRESS",
	COMPLETED = "COMPLETED"
}

export class LiteratureGame implements ILiteratureGame {
	id: string;
	code: string;
	playerCount: number;
	createdBy: string;
	createdTimestamp: string;
	status: LiteratureGameStatus;
	players: Record<string, LiteraturePlayer>;
	hands: Record<string, CardHand>;
	teams: Record<string, LiteratureTeam>;
	moves: Array<LiteratureMove>;
	currentTurn: string;

	private constructor( gameData: ILiteratureGame ) {
		this.id = gameData.id;
		this.code = gameData.code;
		this.playerCount = gameData.playerCount;
		this.createdBy = gameData.createdBy;
		this.createdTimestamp = gameData.createdTimestamp;
		this.status = gameData.status;

		this.players = {};
		Object.values( gameData.players ).forEach( player => {
			this.players[ player.id ] = LiteraturePlayer.from( player );
		} );

		this.hands = {};
		Object.values( gameData.hands ).forEach( ( hand, index ) => {
			const playerId = Object.values( gameData.players )[ index ].id;
			this.hands[ playerId ] = CardHand.from( hand );
		} );

		this.teams = {};
		Object.values( gameData.teams ).forEach( team => {
			this.teams[ team.name ] = LiteratureTeam.from( team );
		} );

		this.moves = gameData.moves;
		this.currentTurn = gameData.currentTurn;
	}

	static from( gameData: ILiteratureGame ) {
		return new LiteratureGame( gameData );
	}

	static generateGameCode() {
		const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		let result = "";
		for ( let i = 0; i < 6; i++ ) {
			result += chars[ Math.floor( Math.random() * 36 ) ];
		}
		return result;
	}

	dealCards() {
		const deck = new CardDeck();
		deck.removeCardsOfRank( CardRank.SEVEN );
		const hands = deck.generateHands( this.playerCount );

		Object.values( this.players ).forEach( ( player, i ) => {
			this.hands[ player.id ] = hands[ i ]!;
			this.players[ player.id ].hand = hands[ i ];
		} );
	}

	addPlayer( player: LiteraturePlayer ) {
		this.players[ player.id ] = player;
	}

	serialize(): ILiteratureGame {
		return JSON.parse( JSON.stringify( this ) );
	}

	isUserAlreadyInGame( id: string ) {
		return !!this.players[ id ];
	}

	getMyTeam( playerId: string ) {
		const teamName = this.players[ playerId ].team;
		if ( !!teamName ) {
			return this.teams[ teamName ];
		}
		return;
	}

	getOppositeTeam( playerId: string ) {
		const teamName = this.players[ playerId ].team;
		if ( !!teamName ) {
			return Object.values( this.teams ).filter( ( { name } ) => name !== teamName )[ 0 ];
		}
		return;
	}

	createTeams( teams: Array<{ name: string, members: string[] }> ) {
		teams.forEach( ( { name, members } ) => {
			const team = LiteratureTeam.from( { name, members, score: 0, gameId: this.id } );
			this.teams[ team.name ] = team;
			members.forEach( memberId => {
				this.players[ memberId ].team = name;
			} );
		} );
	}

	removeCardsOfSet( cardSet: CardSet ) {
		const cardsCalled = cardSetMap[ cardSet ];

		Object.values( this.players ).forEach( player => {
			if ( player.hand?.containsSome( cardsCalled ) ) {
				player.hand.removeCardsOfSet( cardSet );
				this.hands[ player.id ] = player.hand;
			}
		} );
	}

	getMoveResult( { action, askData, callData, transferData }: LiteratureMoveActionData ): LiteratureMoveResultData {

		switch ( action ) {
			case "ASK" :
				if ( !askData ) {
					throw new Error();
				}

				const card = PlayingCard.from( askData.card );
				const hasCard = this.hands[ askData.from ].contains( card );
				if ( hasCard ) {
					this.hands[ askData.by ].removeCard( card );
					this.hands[ askData.from ].addCard( card );
				}
				return { result: "CARD_TRANSFER", success: hasCard };

			case "CALL":
				return { result: "CALL_SET", success: true };

			case "CHANCE_TRANSFER" :
				return { result: "CHANCE_TRANSFER", success: true };
		}
	}
}

// export class EnhancedLitGame implements IEnhancedLitGame {
// 	readonly id: string;
// 	readonly code: string;
// 	readonly playerCount: number;
// 	readonly createdById: string;
// 	readonly createdAt: Date;
// 	readonly updatedAt: Date;
//
// 	status: LitGameStatus;
//
// 	players: EnhancedLitPlayer[];
// 	teams: EnhancedLitTeam[];
// 	moves: EnhancedLitMove[];
//
// 	readonly creator: EnhancedLitPlayer;
//
// 	playerData: Record<string, EnhancedLitPlayer>;
// 	teamData: Record<string, EnhancedLitTeam>;
// 	loggedInUserId?: string;
//
// 	addMove( move: LitMove ) {
// 		this.moves = [ EnhancedLitMove.from( move ), ...this.moves ];
// 	}
//
// 	getNewMoveData( data: LitMoveParams ) {
// 		switch ( data.type ) {
// 			case LitMoveType.ASK:
// 				const { askedFrom, askedBy, askedFor } = data as LitAskMoveParams;
// 				return {
// 					gameId: this.id,
// 					type: LitMoveType.ASK,
// 					description: `${ askedBy.name } asked for ${ askedFor.cardString } from ${ askedFrom.name }`,
// 					askedFor: askedFor.serialize(),
// 					askedFromId: askedFrom.id,
// 					askedById: askedBy.id
// 				};
//
// 			case LitMoveType.GIVEN: {
// 				const { givingPlayer, takingPlayer, card } = data as LitGiveMoveParams;
// 				return {
// 					gameId: this.id,
// 					type: LitMoveType.GIVEN,
// 					turnId: takingPlayer.id,
// 					description: `${ givingPlayer.name } gave ${ card.cardString } to ${ takingPlayer.name }`
// 				};
// 			}
//
// 			case LitMoveType.TURN: {
// 				const { turnPlayer } = data as LitTurnMoveParams;
// 				return {
// 					gameId: this.id,
// 					type: LitMoveType.TURN,
// 					turnId: turnPlayer.id,
// 					description: `Waiting for ${ turnPlayer.name } to Ask or Call`
// 				};
// 			}
//
// 			case LitMoveType.DECLINED: {
// 				const { askingPlayer, declinedPlayer, card } = data as LitDeclinedMoveParams;
// 				return {
// 					gameId: this.id,
// 					type: LitMoveType.DECLINED,
// 					turnId: declinedPlayer.id,
// 					description: `${ declinedPlayer.name } declined ${ askingPlayer.name }'s ask for ${
// card.cardString }` }; }  case LitMoveType.CALL_SUCCESS: { const { turnPlayer, cardSet } = data as LitCallMoveParams;
// return { gameId: this.id, type: LitMoveType.CALL_SUCCESS, turnId: turnPlayer.id, description: `${ turnPlayer.name }
// called ${ cardSet } correctly` }; }  case LitMoveType.CALL_FAIL: { const { turnPlayer, cardSet, callingPlayer } =
// data as LitCallMoveParams; return { gameId: this.id, type: LitMoveType.CALL_FAIL, turnId: turnPlayer.id,
// description: `${ callingPlayer.name } called ${ cardSet } incorrectly. ${ turnPlayer.name }'s turn` }; } } }
// handlePlayerUpdate( ...players: LitPlayer[] ) { players.forEach( player => { this.playerData[ player.id ] =
// EnhancedLitPlayer.from( player ); } );  this.players = Object.values( this.playerData ); this.updateTeams(); }
// handleTeamUpdate( ...teams: LitTeam[] ) { teams.forEach( team => { this.teamData[ team.id ] = EnhancedLitTeam.from(
// team ); this.teamData[ team.id ].addMembers( this.players ); } );  this.teams = Object.values( this.teamData ); }
// private updateTeams() { Object.keys( this.teamData ).map( teamId => { this.teamData[ teamId ].members =
// this.players.filter( player => player.teamId === teamId ); } );  this.teams = Object.values( this.teamData ); } }