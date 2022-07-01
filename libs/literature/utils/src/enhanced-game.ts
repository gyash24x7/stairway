import { LitGame, LitGameStatus, LitMove, LitMoveType, LitPlayer, LitTeam, Prisma } from "@prisma/client";
import { CardDeck, CardHand, CardRank, CardSet, cardSetMap, IPlayingCard, PlayingCard } from "@s2h/cards";
import { EnhancedLitPlayer, IEnhancedLitPlayer } from "./enhanced-player";
import { EnhancedLitTeam, IEnhancedLitTeam } from "./enhanced-team";
import { EnhancedLitMove, IEnhancedLitMove } from "./enhanced-move";

type LitGameData = LitGame & { players: LitPlayer[], moves: LitMove[], teams: LitTeam[] }
type LitMoveDataWithoutDescription = Omit<Prisma.LitMoveUncheckedCreateInput, "description">;

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

		this.creator = this.players.find( player => player.userId === this.createdById )!

		this.playerData = {};
		this.players.forEach( player => {
			this.playerData[ player.id ] = player;
		} )

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
		return this.teams[ 0 ]?.id !== this.loggedInPlayer.teamId ? this.teams[ 0 ] : this.teams[ 1 ];
	}

	static from( gameData: LitGameData ) {
		const players = gameData.players.map( EnhancedLitPlayer.from );
		const teams = gameData.teams.map( team => EnhancedLitTeam.from( team, players ) );
		const moves = gameData.moves.sort( EnhancedLitMove.compareFn ).map( EnhancedLitMove.from );

		return new EnhancedLitGame( { ...gameData, players, teams, moves } );
	}

	addTeams( teams: LitTeam[], playerGroups: EnhancedLitPlayer[][] ) {
		playerGroups.forEach( ( playerGroup, i ) => {
			playerGroup.forEach( player => {
				this.playerData[ player.id ].teamId = teams[ i ].id;
			} );
		} );

		this.players = Object.values( this.playerData );

		this.teams = teams.map( team => EnhancedLitTeam.from( team, this.players ) );
		this.teams.forEach( team => {
			this.teamData[ team.id ] = team;
		} );
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

	getNewMoveDescription( newMoveData: LitMoveDataWithoutDescription ) {
		let turnPlayer: EnhancedLitPlayer | null;
		let askedFromPlayer: EnhancedLitPlayer | null;
		let callingPlayer: EnhancedLitPlayer | null;
		let askingPlayer: EnhancedLitPlayer | null;
		let card: PlayingCard | null;

		const lastMove = this.moves[ 0 ];

		switch ( newMoveData.type ) {
			case LitMoveType.ASK:
				askingPlayer = !!newMoveData.askedById ? this.playerData[ newMoveData.askedById ] : null;
				askedFromPlayer = !!newMoveData.askedFromId ? this.playerData[ newMoveData.askedFromId ] : null;
				card = !!newMoveData.askedFor
					? PlayingCard.from( newMoveData.askedFor as unknown as IPlayingCard )
					: null;
				return `${ askingPlayer?.name } asked for ${ card?.cardString } from ${ askedFromPlayer?.name }`;

			case LitMoveType.TURN:
				turnPlayer = !!newMoveData.turnId ? this.playerData[ newMoveData.turnId ] : null;
				return `Waiting for ${ turnPlayer?.name } to Ask or Call`;

			case LitMoveType.GIVEN:
				turnPlayer = !!newMoveData.turnId ? this.playerData[ newMoveData.turnId ] : null;
				askedFromPlayer = !!lastMove?.askedFromId ? this.playerData[ lastMove.askedFromId ] : null;
				card = lastMove?.askedFor;
				return `${ askedFromPlayer?.name } gave ${ card?.cardString } to ${ turnPlayer?.name }`;

			case LitMoveType.DECLINED:
				turnPlayer = !!newMoveData.turnId ? this.playerData[ newMoveData.turnId ] : null;
				askingPlayer = !!lastMove?.askedById ? this.playerData[ lastMove.askedById ] : null;
				card = lastMove?.askedFor;
				return `${ turnPlayer?.name } declined ${ askingPlayer?.name }'s ask for ${ card?.cardString }`;

			case LitMoveType.CALL_SUCCESS:
				turnPlayer = !!newMoveData.turnId ? this.playerData[ newMoveData.turnId ] : null;
				return `${ turnPlayer?.name } called ${ CardSet.SMALL_HEARTS } correctly`;

			case LitMoveType.CALL_FAIL:
				turnPlayer = !!newMoveData.turnId ? this.playerData[ newMoveData.turnId ] : null;
				callingPlayer = !!lastMove?.turnId ? this.playerData[ lastMove.turnId ] : null;
				return `${ callingPlayer?.name } called ${ CardSet.SMALL_HEARTS } incorrectly. ${ turnPlayer?.name }"s turn`;
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
			this.teamData[ team.id ] = EnhancedLitTeam.from( team, this.players );
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