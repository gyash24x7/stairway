import { ILiteraturePlayer, LiteraturePlayer } from "./player";
import { ILiteratureTeam, LiteratureTeam } from "./team";
import { CardDeck, CardHand, CardRank, generateGameCode, ICardHand, PlayingCard } from "@s2h/cards";
import type { AskMoveData, CallMoveData, ILiteratureMove, TransferMoveData } from "./move";
import { LiteratureMove } from "./move";
import type { UserAuthInfo } from "@auth/data";

export enum LiteratureGameStatus {
	CREATED = "CREATED",
	PLAYERS_READY = "PLAYERS_READY",
	TEAMS_CREATED = "TEAMS_CREATED",
	IN_PROGRESS = "IN_PROGRESS",
	COMPLETED = "COMPLETED"
}

export interface ILiteratureGame {
	code: string;
	playerCount: number;
	status: LiteratureGameStatus;
	currentTurn: string;
	createdBy: string;
	players: Record<string, ILiteraturePlayer>;
	teams: Record<string, ILiteratureTeam>;
}

export class LiteratureGame implements ILiteratureGame {
	readonly id: string;
	readonly code: string;
	readonly createdBy: string;
	readonly playerCount: number;

	status: LiteratureGameStatus;
	currentTurn: string;

	players: Record<string, LiteraturePlayer> = {};
	teams: Record<string, LiteratureTeam> = {};

	private constructor( data: ILiteratureGame & { id: string } ) {
		this.id = data.id;
		this.code = data.code;
		this.playerCount = data.playerCount;
		this.createdBy = data.createdBy;
		this.status = data.status;
		this.currentTurn = data.currentTurn ?? data.createdBy;

		Object.values( data.players ).forEach( player => {
			this.players[ player.id ] = LiteraturePlayer.from( player );
		} );

		Object.values( data.teams ).forEach( team => {
			this.teams[ team.id ] = LiteratureTeam.from( team );
		} );
	}

	get playerIds() {
		return Object.keys( this.players );
	}

	get playerList() {
		return Object.values( this.players );
	}

	get teamIds() {
		return Object.keys( this.teams );
	}

	get teamList() {
		return Object.values( this.teams );
	}

	get creator() {
		return this.players[ this.createdBy ];
	}

	static from( id: string, data: ILiteratureGame ) {
		return new LiteratureGame( { ...data, id } );
	}

	static createNew( id: string, playerCount: number, authInfo: UserAuthInfo ) {
		return new LiteratureGame( {
			id,
			code: generateGameCode(),
			playerCount,
			createdBy: authInfo.id,
			players: {},
			teams: {},
			status: LiteratureGameStatus.CREATED,
			currentTurn: authInfo.id
		} );
	}

	static aggregate( game: LiteratureGame, gameHands: Record<string, CardHand>, moves: Array<LiteratureMove> ) {
		const cardCounts: Record<string, number> = {};
		Object.keys( gameHands ).map( id => {
			cardCounts[ id ] = gameHands[ id ].length;
		} );

		const aggregateDataMap: Record<string, AggregatedGameData> = {};
		game.playerIds.forEach( playerId => {
			const hand: CardHand | undefined = gameHands[ playerId ];
			aggregateDataMap[ playerId ] = AggregatedGameData.from( { game, cardCounts, playerId, moves, hand } );
		} );

		return aggregateDataMap;
	}

	dealCards() {
		const deck = new CardDeck();
		deck.removeCardsOfRank( CardRank.SEVEN );
		const hands = deck.generateHands( this.playerCount );
		const handData: Record<string, CardHand> = {};

		this.playerList.forEach( ( player, i ) => {
			handData[ player.id ] = hands[ i ];
		} );

		return handData;
	}

	addPlayers( ...players: LiteraturePlayer[] ) {
		players.forEach( player => {
			this.players[ player.id ] = player;
		} );
	}

	isUserAlreadyInGame( id: string ) {
		return !!this.players[ id ];
	}

	addTeams( teams: LiteratureTeam[] ) {
		teams.forEach( team => {
			team.members.map( id => {
				this.players[ id ].teamId = team.id;
			} );

			this.teams[ team.id ] = team;
		} );
	}

	executeTransferMove( { to }: TransferMoveData ): boolean {
		this.currentTurn = to;
		return true;
	}

	executeCallMove( { actualCall, by }: CallMoveData, hands: Record<string, CardHand> ): boolean {
		const callingPlayer = this.players[ by ]!;
		const teamMembers = this.teams[ callingPlayer?.teamId! ]?.members
			.map( memberId => this.players[ memberId ]! ) ?? [];

		let cardsCalledCorrect = 0;
		teamMembers.forEach( member => {
			const cardsCalledForPlayer = actualCall[ member.id ]?.map( PlayingCard.from ) ?? [];
			if ( !!cardsCalledForPlayer ) {
				if ( hands[ member.id ].containsAll( cardsCalledForPlayer ) ) {
					cardsCalledCorrect += cardsCalledForPlayer.length;
				}
			}
		} );

		const success = cardsCalledCorrect === 6;
		this.handleCallSet( success, callingPlayer, hands );
		return success;
	}

	executeAskMove( { from, by, card: c }: AskMoveData, hands: Record<string, CardHand> ) {
		const askedPlayer = this.players[ from ]!;
		const card = PlayingCard.from( c );
		const fromHand = hands[ from ];
		const byHand = hands[ by ];
		const hasCard = fromHand.contains( card );

		if ( hasCard ) {
			fromHand.removeCard( card );
			byHand.addCard( card );
			return { [ from ]: fromHand, [ by ]: byHand };
		} else {
			this.currentTurn = askedPlayer.id;
			return undefined;
		}
	}

	serialize(): ILiteratureGame & { id: string } {
		const { id, code, currentTurn, createdBy, players, playerCount, status, teams } = this;
		return { id, code, currentTurn, teams, players, playerCount, status, createdBy };
	}

	private handleCallSet( success: boolean, player: LiteraturePlayer, hands: Record<string, CardHand> ) {
		const oppositeTeamId = Object.keys( this.teams ).find( name => name !== player.teamId )!;
		this.teams[ success ? player.teamId! : oppositeTeamId ].score++;

		if ( success ) {
			if ( hands[ player.id ].isEmpty() ) {
				this.currentTurn = this.teams[ player.teamId! ]?.members
					.find( id => id !== player.id && !hands[ id ].isEmpty() )!;
			} else {
				this.currentTurn = player.id;
			}
		} else {
			this.currentTurn = this.teams[ oppositeTeamId ]?.members.find( id => !hands[ id ].isEmpty() )!;
		}
	}
}

export interface IAggregatedGameData {
	game: ILiteratureGame & { id: string };
	cardCounts: Record<string, number>;
	playerId: string;
	hand?: ICardHand;
	moves: ( ILiteratureMove & { id: string } )[];
}

export class AggregatedGameData implements IAggregatedGameData {
	game: LiteratureGame;
	cardCounts: Record<string, number>;
	hand?: CardHand;
	moves: LiteratureMove[];
	playerId: string;

	private constructor( data: IAggregatedGameData ) {
		this.game = LiteratureGame.from( data.game.id, data.game );
		this.cardCounts = data.cardCounts;
		this.playerId = data.playerId;
		this.hand = !!data.hand ? CardHand.from( data.hand ) : undefined;
		this.moves = data.moves.map( move => LiteratureMove.from( move.id, move ) );
	}

	static from( data: IAggregatedGameData ) {
		return new AggregatedGameData( data );
	}

	serialize(): IAggregatedGameData {
		const { game, cardCounts, playerId, moves, hand } = this;
		return {
			game: game.serialize(),
			playerId,
			hand: hand?.serialize(),
			moves: moves.map( move => move.serialize() ),
			cardCounts
		};
	}
}