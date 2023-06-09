import { createId } from "@paralleldrive/cuid2";
import { CardDeck, CardHand, CardRank, ICardHand, PlayingCard } from "@s2h/cards";
import { IUser } from "@s2h/utils";
import dayjs from "dayjs";
import { AskActionData, CallActionData, TransferActionData } from "./move";
import { ILiteraturePlayer, LiteraturePlayer } from "./player";
import { ILiteratureTeam, LiteratureTeam } from "./team";

export interface ILiteratureGame {
	id: string;
	code: string;
	playerCount: number;
	createdBy: string;
	timestamp: string;
	status: LiteratureGameStatus;
	currentTurn: string;
	players: Record<string, ILiteraturePlayer>;
	teams: Record<string, ILiteratureTeam>;
	initialHands: Record<string, ICardHand>;
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
	timestamp: string;
	status: LiteratureGameStatus;
	currentTurn: string;
	players: Record<string, LiteraturePlayer>;
	teams: Record<string, LiteratureTeam>;
	initialHands: Record<string, CardHand>;

	private constructor( gameData: ILiteratureGame ) {
		this.id = gameData.id;
		this.code = gameData.code;
		this.playerCount = gameData.playerCount;
		this.createdBy = gameData.createdBy;
		this.timestamp = gameData.timestamp;
		this.status = gameData.status;

		this.players = {};
		Object.values( gameData.players ).forEach( player => {
			this.players[ player.id ] = LiteraturePlayer.from( player );
		} );

		this.teams = {};
		Object.values( gameData.teams ).forEach( team => {
			this.teams[ team.name ] = LiteratureTeam.from( team );
		} );

		this.currentTurn = gameData.currentTurn;
	}

	get creator() {
		return this.players[ this.createdBy ];
	}

	get playerList() {
		return Object.values( this.players );
	}

	get playerIds() {
		return Object.keys( this.players );
	}

	get teamList() {
		return Object.values( this.teams );
	}

	get teamIds() {
		return Object.keys( this.teams );
	}

	static create( playerCount: number, loggedInUser: IUser ) {
		return new LiteratureGame( {
			id: createId(),
			createdBy: loggedInUser.id,
			players: {},
			teams: {},
			code: LiteratureGame.generateGameCode(),
			playerCount,
			timestamp: dayjs().toISOString(),
			status: LiteratureGameStatus.CREATED,
			currentTurn: loggedInUser.id,
			initialHands: {}
		} );
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
			this.initialHands[ player.id ] = hands[ i ];
		} );

		return this.initialHands;
	}

	addPlayers( ...players: ILiteraturePlayer[] ) {
		players.forEach( ( player ) => {
			this.players[ player.id ] = LiteraturePlayer.from( player );
		} );
	}

	serialize(): ILiteratureGame {
		return JSON.parse( JSON.stringify( this ) );
	}

	isUserAlreadyInGame( id: string ) {
		return !!this.players[ id ];
	}

	createTeams( teams: Array<{ name: string, members: string[] }> ) {
		teams.forEach( ( { name, members } ) => {
			const team = LiteratureTeam.from( { name, members, score: 0, id: createId() } );
			this.teams[ team.name ] = team;
			members.forEach( memberId => {
				this.players[ memberId ].teamId = name;
			} );
		} );
	}

	executeChanceTransferMove( { to }: TransferActionData ): boolean {
		this.currentTurn = to;
		return true;
	}

	executeCallMove( { data, by }: CallActionData, hands: Record<string, ICardHand> ): boolean {
		const callingPlayer = this.players[ by ];
		const teamMembers = this.teams[ callingPlayer.teamId! ].members.map( memberId => this.players[ memberId ] );

		let cardsCalledCorrect = 0;
		teamMembers.forEach( member => {
			const cardsCalledForPlayer = data[ member.id ].cards.map( PlayingCard.from );
			if ( !!cardsCalledForPlayer ) {
				if ( CardHand.from( hands[ member.id ] ).containsAll( cardsCalledForPlayer ) ) {
					cardsCalledCorrect += cardsCalledForPlayer.length;
				}
			}
		} );

		const success = cardsCalledCorrect === 6;
		this.handleCallSet( success, callingPlayer, hands );
		return success;
	}

	executeAskMove( { from, by, card: c }: AskActionData, hands: Record<string, ICardHand> ) {
		const askedPlayer = this.players[ from ];
		const card = PlayingCard.from( c );
		const fromHand = CardHand.from( hands[ from ] );
		const byHand = CardHand.from( hands[ by ] );
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

	private handleCallSet( success: boolean, player: LiteraturePlayer, hands: Record<string, ICardHand> ) {
		const oppositeTeamId = Object.keys( this.teams ).find( name => name !== player.teamId )!;
		this.teams[ success ? player.teamId! : oppositeTeamId ].score++;

		if ( success ) {
			if ( CardHand.from( hands[ player.id ] ).isEmpty() ) {
				this.currentTurn = this.teams[ player.teamId! ].members.find(
					id => id !== player.id && !CardHand.from( hands[ id ] ).isEmpty()
				)!;
			} else {
				this.currentTurn = player.id;
			}
		} else {
			this.currentTurn = this.teams[ oppositeTeamId ].members.find(
				id => !CardHand.from( hands[ id ] ).isEmpty()
			)!;
		}
	}
}
