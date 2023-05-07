import { LitGame, LitGameStatus, LitMove, LitMoveType, LitPlayer, LitTeam, Prisma, User } from "@prisma/client";
import { CardDeck, CardHand, CardRank, CardSet, cardSetMap, PlayingCard } from "@s2h/cards";
import { EnhancedLitMove, IEnhancedLitMove } from "./enhanced-move";
import { EnhancedLitPlayer, IEnhancedLitPlayer } from "./enhanced-player";
import { EnhancedLitTeam, IEnhancedLitTeam } from "./enhanced-team";

type LitGameData = LitGame & { players: LitPlayer[], moves: LitMove[], teams: LitTeam[] }

type LitAskMoveParams = { askedFrom: EnhancedLitPlayer, askedBy: EnhancedLitPlayer, askedFor: PlayingCard };
type LitGiveMoveParams = { givingPlayer: EnhancedLitPlayer, takingPlayer: EnhancedLitPlayer, card: PlayingCard };
type LitTurnMoveParams = { turnPlayer: EnhancedLitPlayer };
type LitDeclinedMoveParams = { askingPlayer: EnhancedLitPlayer, declinedPlayer: EnhancedLitPlayer, card: PlayingCard };
type LitCallMoveParams = { turnPlayer: EnhancedLitPlayer, cardSet: CardSet, callingPlayer: EnhancedLitPlayer };

type LitMoveParams = { type: LitMoveType } & (
	LitGiveMoveParams
	| LitAskMoveParams
	| LitTurnMoveParams
	| LitDeclinedMoveParams
	| LitCallMoveParams );

type LitCreateGameParams = { playerCount?: number, createdBy: User };

export interface IEnhancedLitGame {
	id: string;
	code: string;
	playerCount: number;
	createdById: string;
	createdAt: Date;
	updatedAt: Date;
	status: LitGameStatus;
	players: IEnhancedLitPlayer[];
	teams: IEnhancedLitTeam[];
	moves: IEnhancedLitMove[];
}

export class EnhancedLitGame implements IEnhancedLitGame {
	readonly id: string;
	readonly code: string;
	readonly playerCount: number;
	readonly createdById: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;

	status: LitGameStatus;

	players: EnhancedLitPlayer[];
	teams: EnhancedLitTeam[];
	moves: EnhancedLitMove[];

	readonly creator: EnhancedLitPlayer;

	playerData: Record<string, EnhancedLitPlayer>;
	teamData: Record<string, EnhancedLitTeam>;
	loggedInUserId?: string;

	constructor( game: IEnhancedLitGame ) {
		this.id = game.id;
		this.code = game.code;
		this.playerCount = game.playerCount;
		this.createdById = game.createdById;
		this.createdAt = game.createdAt;
		this.updatedAt = game.updatedAt;
		this.status = game.status;
		this.players = game.players.map( player => new EnhancedLitPlayer( player ) );
		this.teams = game.teams.map( team => new EnhancedLitTeam( team ) );
		this.moves = game.moves.map( move => new EnhancedLitMove( move ) );

		this.creator = this.players.find( player => player.userId === this.createdById )!;

		this.playerData = {};
		this.players.forEach( player => {
			this.playerData[ player.id ] = player;
		} );

		this.teamData = {};
		this.teams.forEach( team => {
			this.teamData[ team.id ] = team;
		} );
	}

	get loggedInPlayer() {
		return this.players.find( player => player.userId === this.loggedInUserId );
	}

	get askableCardSets() {
		const hand = this.loggedInPlayer?.hand || CardHand.from( { cards: [] } );
		return hand.cardSetsInHand.filter( cardSet => hand.getCardsOfSet( cardSet ).length < 6 );
	}

	get callableCardSets() {
		const hand = this.loggedInPlayer?.hand || CardHand.from( { cards: [] } );
		return hand.cardSetsInHand.filter( cardSet => hand.getCardsOfSet( cardSet ).length <= 6 );
	}

	get myTeam() {
		if ( !this.loggedInPlayer?.teamId ) {
			return null;
		}
		return this.teamData[ this.loggedInPlayer.teamId ];
	}

	get oppositeTeam() {
		if ( !this.loggedInPlayer?.teamId ) {
			return null;
		}
		return this.teams[ 0 ].id !== this.loggedInPlayer.teamId ? this.teams[ 0 ] : this.teams[ 1 ];
	}

	static from( gameData: LitGameData ) {
		const players = gameData.players.map( EnhancedLitPlayer.from );
		const teams = gameData.teams.map( team => {
			const enhancedTeam = EnhancedLitTeam.from( team );
			enhancedTeam.addMembers( players );
			return enhancedTeam;
		} );
		const moves = gameData.moves.map( EnhancedLitMove.from )
			.sort( ( a, b ) => b.createdAt.getTime() - a.createdAt.getTime() );

		return new EnhancedLitGame( { ...gameData, players, teams, moves } );
	}

	static generateGameCode() {
		const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		let result = "";
		for ( let i = 0; i < 6; i++ ) {
			result += chars[ Math.floor( Math.random() * 36 ) ];
		}
		return result;
	}

	static generateNewGameData( { playerCount, createdBy }: LitCreateGameParams ) {
		return { createdById: createdBy.id, playerCount, code: EnhancedLitGame.generateGameCode() };
	}

	generateNewPlayerData( { name, avatar, id }: User ): Prisma.LitPlayerUncheckedCreateInput {
		return { name, avatar, userId: id, hand: { cards: [] }, gameId: this.id };
	}

	addPlayer( player: LitPlayer ) {
		this.playerData[ player.id ] = EnhancedLitPlayer.from( player );
		this.players = Object.values( this.playerData );
	}

	isUserAlreadyInGame( { id }: User ) {
		return !!this.players.find( player => player.userId === id );
	}

	addTeams( teams: LitTeam[] ) {
		teams.forEach( team => {
			this.teamData[ team.id ] = EnhancedLitTeam.from( team );
		} );

		this.teams = Object.values( this.teamData );
	}

	dealCardsAndGetHands() {
		const deck = new CardDeck();
		deck.removeCardsOfRank( CardRank.SEVEN );
		const hands = deck.generateHands( this.playerCount );

		const handData: Record<string, CardHand> = {};
		this.players.forEach( ( player, i ) => {
			handData[ player.id ] = hands[ i ]!;
		} );

		return handData;
	}

	addMove( move: LitMove ) {
		this.moves = [ EnhancedLitMove.from( move ), ...this.moves ];
	}

	getNewMoveData( data: LitMoveParams ) {
		switch ( data.type ) {
			case LitMoveType.ASK:
				const { askedFrom, askedBy, askedFor } = data as LitAskMoveParams;
				return {
					gameId: this.id,
					type: LitMoveType.ASK,
					description: `${ askedBy.name } asked for ${ askedFor.cardString } from ${ askedFrom.name }`,
					askedFor: askedFor.serialize(),
					askedFromId: askedFrom.id,
					askedById: askedBy.id
				};

			case LitMoveType.GIVEN: {
				const { givingPlayer, takingPlayer, card } = data as LitGiveMoveParams;
				return {
					gameId: this.id,
					type: LitMoveType.GIVEN,
					turnId: takingPlayer.id,
					description: `${ givingPlayer.name } gave ${ card.cardString } to ${ takingPlayer.name }`
				};
			}

			case LitMoveType.TURN: {
				const { turnPlayer } = data as LitTurnMoveParams;
				return {
					gameId: this.id,
					type: LitMoveType.TURN,
					turnId: turnPlayer.id,
					description: `Waiting for ${ turnPlayer.name } to Ask or Call`
				};
			}

			case LitMoveType.DECLINED: {
				const { askingPlayer, declinedPlayer, card } = data as LitDeclinedMoveParams;
				return {
					gameId: this.id,
					type: LitMoveType.DECLINED,
					turnId: declinedPlayer.id,
					description: `${ declinedPlayer.name } declined ${ askingPlayer.name }'s ask for ${ card.cardString }`
				};
			}

			case LitMoveType.CALL_SUCCESS: {
				const { turnPlayer, cardSet } = data as LitCallMoveParams;
				return {
					gameId: this.id,
					type: LitMoveType.CALL_SUCCESS,
					turnId: turnPlayer.id,
					description: `${ turnPlayer.name } called ${ cardSet } correctly`
				};
			}

			case LitMoveType.CALL_FAIL: {
				const { turnPlayer, cardSet, callingPlayer } = data as LitCallMoveParams;
				return {
					gameId: this.id,
					type: LitMoveType.CALL_FAIL,
					turnId: turnPlayer.id,
					description: `${ callingPlayer.name } called ${ cardSet } incorrectly. ${ turnPlayer.name }'s turn`
				};
			}
		}
	}

	handlePlayerUpdate( ...players: LitPlayer[] ) {
		players.forEach( player => {
			this.playerData[ player.id ] = EnhancedLitPlayer.from( player );
		} );

		this.players = Object.values( this.playerData );
		this.updateTeams();
	}

	removeCardsOfSetFromGameAndGetUpdatedHands( cardSet: CardSet ) {
		const handData: Record<string, CardHand> = {};
		const cardsCalled = cardSetMap[ cardSet ];

		this.players.forEach( player => {
			if ( player.hand.containsSome( cardsCalled ) ) {
				player.hand.removeCardsOfSet( cardSet );
				handData[ player.id ] = player.hand;
			}
		} );

		return handData;
	}

	handleTeamUpdate( ...teams: LitTeam[] ) {
		teams.forEach( team => {
			this.teamData[ team.id ] = EnhancedLitTeam.from( team );
			this.teamData[ team.id ].addMembers( this.players );
		} );

		this.teams = Object.values( this.teamData );
	}

	private updateTeams() {
		Object.keys( this.teamData ).map( teamId => {
			this.teamData[ teamId ].members = this.players.filter( player => player.teamId === teamId );
		} );

		this.teams = Object.values( this.teamData );
	}
}