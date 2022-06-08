import { Exclude, Expose, instanceToPlain, plainToInstance, Type } from "class-transformer";
import { LitGameStatus, LitMove, LitMoveType, LitPlayer, LitTeam, Prisma } from "@prisma/client";
import { CardDeck, CardHand, CardRank, CardSet, PlayingCard } from "@s2h/cards";
import { EnhancedLitPlayer } from "./lit-player";
import { EnhancedLitTeam } from "./lit-team";
import { EnhancedLitMove } from "./lit-move";
import type { LitGameData, LitMoveDataWithoutDescription } from "@s2h/utils";

export class EnhancedLitGame {
	@Expose() readonly id: string;
	@Expose() readonly code: string;
	@Expose() readonly playerCount: number;
	@Expose() readonly createdById: string;
	@Expose() readonly createdAt: Date;
	@Expose() readonly updatedAt: Date;

	@Expose() status: LitGameStatus;

	@Type( () => EnhancedLitPlayer )
	@Expose() players: EnhancedLitPlayer[];

	@Type( () => EnhancedLitTeam )
	@Expose() teams: EnhancedLitTeam[];

	@Type( () => EnhancedLitMove )
	@Expose() moves: EnhancedLitMove[];

	@Expose() readonly creator: EnhancedLitPlayer;

	@Exclude() playerData: Record<string, EnhancedLitPlayer>;
	@Exclude() teamData: Record<string, EnhancedLitTeam>;
	@Exclude() loggedInUserId?: string;

	constructor( game: LitGameData ) {
		this.id = game.id;
		this.code = game.code;
		this.status = game.status;
		this.playerCount = game.playerCount;
		this.createdAt = game.createdAt;
		this.createdById = game.createdById;
		this.updatedAt = game.updatedAt;

		this.players = game.players.map( player => new EnhancedLitPlayer( player ) );
		this.teams = game.teams.map( team => new EnhancedLitTeam( team, this.players ) );
		this.moves = game.moves.sort( EnhancedLitMove.compareFn ).map( move => new EnhancedLitMove( move ) );

		this.playerData = {};
		this.players.forEach( player => {
			this.playerData[ player.id ] = player;
		} );

		this.teamData = {};
		this.teams.forEach( team => {
			this.teamData[ team.id ] = team;
		} );

		this.creator = this.players.find( player => player.userId === this.createdById )!;
	}

	@Exclude()
	get loggedInPlayer() {
		return this.players.find( player => player.userId === this.loggedInUserId );
	}

	@Exclude()
	get askableCardSets() {
		const hand = this.loggedInPlayer?.hand || new CardHand( [] );
		return hand.cardSetsInHand.filter( cardSet => hand.getCardsOfSet( cardSet ).length < 6 );
	}

	@Exclude()
	get callableCardSets() {
		const hand = this.loggedInPlayer?.hand || new CardHand( [] );
		return hand.cardSetsInHand.filter( cardSet => hand.getCardsOfSet( cardSet ).length < 6 );
	}

	@Exclude()
	get myTeam() {
		if ( !this.loggedInPlayer?.teamId ) {
			return null;
		}
		return this.teamData[ this.loggedInPlayer.teamId ];
	}

	@Exclude()
	get oppositeTeam() {
		if ( !this.loggedInPlayer?.teamId ) {
			return null;
		}
		return this.teams[ 0 ]?.id !== this.loggedInPlayer.teamId ? this.teams[ 0 ] : this.teams[ 1 ];
	}

	static from( enhancedLitGame: Record<string, any> ) {
		return plainToInstance( EnhancedLitGame, enhancedLitGame );
	}

	serialize() {
		return instanceToPlain( this );
	}

	addTeams( teams: LitTeam[], playerGroups: EnhancedLitPlayer[][] ) {
		playerGroups.forEach( ( playerGroup, i ) => {
			playerGroup.forEach( player => {
				this.playerData[ player.id ].teamId = teams[ i ].id;
			} );
		} );

		this.players = Object.values( this.playerData );

		this.teams = teams.map( team => new EnhancedLitTeam( team, this.players ) );
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
		this.moves = [ new EnhancedLitMove( move ), ...this.moves ];
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
				card = !!newMoveData.askedFor ? PlayingCard.from( newMoveData.askedFor as Prisma.JsonObject ) : null;
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
				return `${ turnPlayer?.name } declined ${ askingPlayer?.name }"s ask for ${ card?.cardString }`;

			case LitMoveType.CALL:
				turnPlayer = !!newMoveData.turnId ? this.playerData[ newMoveData.turnId ] : null;
				return `${ turnPlayer?.name } is calling ${ newMoveData?.callingSet }`;

			case LitMoveType.CALL_SUCCESS:
				turnPlayer = !!newMoveData.turnId ? this.playerData[ newMoveData.turnId ] : null;
				return `${ turnPlayer?.name } called ${ lastMove?.callingSet } correctly`;

			case LitMoveType.CALL_FAIL:
				turnPlayer = !!newMoveData.turnId ? this.playerData[ newMoveData.turnId ] : null;
				callingPlayer = !!lastMove?.turnId ? this.playerData[ lastMove.turnId ] : null;
				return `${ callingPlayer?.name } called ${ lastMove?.callingSet } incorrectly. ${ turnPlayer?.name }"s turn`;
		}
	}

	handlePlayerUpdate( ...players: LitPlayer[] ) {
		players.forEach( player => {
			this.playerData[ player.id ] = new EnhancedLitPlayer( player );
		} );

		this.players = Object.values( this.playerData );
		this.updateTeams();
	}

	removeCalledCardsFromGameAndGetUpdatedHands( cardSet: CardSet, cardsCalled: PlayingCard[] ) {
		const handData: Record<string, CardHand> = {};

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
			this.teamData[ team.id ] = new EnhancedLitTeam( team, this.players );
		} );

		this.teams = Object.values( this.teamData );
	}

	private updateTeams() {
		Object.keys( this.teamData ).map( teamId => {
			this.teamData[ teamId ]!.members = this.players.filter( player => player.teamId === teamId );
		} );

		this.teams = Object.values( this.teamData );
	}
}