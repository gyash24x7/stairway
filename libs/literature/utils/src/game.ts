import { CardDeck, CardHand, CardRank, CardSet, cardSetMap, ICardHand, PlayingCard } from "@s2h/cards";
import {
	AskActionData,
	CallActionData,
	ILiteratureMove,
	LiteratureMove,
	LiteratureMoveActionData,
	LiteratureMoveResultData
} from "./move";
import { ILiteraturePlayer, LiteraturePlayer } from "./player";
import { ILiteratureTeam, LiteratureTeam } from "./team";
import { set } from "zod";
import { createId } from "@paralleldrive/cuid2";
import { IUser } from "@s2h/utils";
import dayjs from "dayjs";

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
		Object.keys( gameData.hands ).forEach( playerId => {
			this.hands[ playerId ] = CardHand.from( gameData.hands[ playerId ] );
		} );

		this.teams = {};
		Object.values( gameData.teams ).forEach( team => {
			this.teams[ team.name ] = LiteratureTeam.from( team );
		} );

		this.moves = gameData.moves.map( LiteratureMove.from );
		this.currentTurn = gameData.currentTurn;
	}

	static create( playerCount: number, loggedInUser: IUser ) {
		return new LiteratureGame( {
			id: createId(),
			createdBy: loggedInUser.id,
			players: { [ loggedInUser.id ]: { ...loggedInUser, hand: CardHand.empty() } },
			teams: {},
			hands: {},
			code: LiteratureGame.generateGameCode(),
			playerCount,
			moves: [],
			createdTimestamp: dayjs().toISOString(),
			status: LiteratureGameStatus.CREATED,
			currentTurn: loggedInUser.id
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

	addCardsToPlayer( playerId: string, ...cards: PlayingCard[] ) {
		this.hands[ playerId ].addCard( ...cards );
		this.players[ playerId ].hand = this.hands[ playerId ];
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

	addPlayer( player: ILiteraturePlayer ) {
		this.players[ player.id ] = LiteraturePlayer.from( player );
	}

	serialize(): ILiteratureGame {
		return JSON.parse( JSON.stringify( this ) );
	}

	isUserAlreadyInGame( id: string ) {
		return !!this.players[ id ];
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

		Object.keys( this.hands ).forEach( playerId => {
			if ( this.hands[ playerId ].containsSome( cardsCalled ) ) {
				this.hands[ playerId ].removeCardsOfSet( cardSet );
				this.players[ playerId ].hand = this.hands[ playerId ];
			}
		} );
	}

	executeMoveAction( actionData: Omit<LiteratureMoveActionData, "description"> ) {
		let resultData: LiteratureMoveResultData;
		let actionDescription: string;
		const { action, askData, callData, transferData } = actionData;

		switch ( action ) {
			case "ASK" :
				const askingPlayer = this.players[ askData!.by ];
				const askedPlayer = this.players[ askData!.from ];
				const card = PlayingCard.from( askData!.card );

				actionDescription = `${ askingPlayer.name } asked ${ askedPlayer.name } for ${ card.cardString }`;
				resultData = this.executeAskMove( askData! );
				break;

			case "CALL_SET":
				const callingPlayer = this.players[ callData!.playerId ];
				actionDescription = `${ callingPlayer.name } is calling ${ set }!`;
				resultData = this.executeCallMove( callData! );
				break;

			case "CHANCE_TRANSFER" :
				const currentPlayer = this.players[ this.currentTurn ];
				const nextPlayer = this.players[ transferData!.playerId ];
				actionDescription = `${ currentPlayer.name } is transferring chance to ${ nextPlayer.name }`;
				this.currentTurn = transferData!.playerId;

				resultData = {
					result: "CHANCE_TRANSFER",
					success: true,
					description: `${ currentPlayer.name } transferred chance to ${ nextPlayer.name }`
				};
		}

		const move = LiteratureMove.create( { ...actionData, description: actionDescription }, resultData );
		this.moves = [ move, ...this.moves ];
	}

	handleCallSet( success: boolean, set: CardSet, player: LiteraturePlayer ) {
		const oppositeTeamId = Object.keys( this.teams ).filter( name => name !== player.team )[ 0 ];
		this.teams[ success ? player.team! : oppositeTeamId ].score++;
		this.removeCardsOfSet( set );
	}

	private executeCallMove( { set, data, playerId }: CallActionData ): LiteratureMoveResultData {
		const callingPlayer = this.players[ playerId ];
		const teamMembers = this.teams[ callingPlayer.team! ].members.map( memberId => this.players[ memberId ] );

		let cardsCalledCorrect = 0;
		teamMembers.forEach( member => {
			const cardsCalledForPlayer = data[ member.id ]?.map( PlayingCard.from );
			if ( !!cardsCalledForPlayer ) {
				if ( member.hand.containsAll( cardsCalledForPlayer ) ) {
					cardsCalledCorrect += cardsCalledForPlayer.length;
				}
			}
		} );

		this.handleCallSet( cardsCalledCorrect === 6, set, callingPlayer );

		return {
			result: "CALL_SET",
			success: cardsCalledCorrect === 6,
			description: cardsCalledCorrect === 6
				? `${ callingPlayer.name } called ${ set } correctly!`
				: `${ callingPlayer.name } called ${ set } incorrectly!`
		};

	}

	private executeAskMove( { by, from, card: c }: AskActionData ): LiteratureMoveResultData {
		const askingPlayer = this.players[ by ];
		const askedPlayer = this.players[ from ];
		const card = PlayingCard.from( c );
		const hasCard = this.hands[ from ].contains( card );

		if ( hasCard ) {
			this.hands[ by ].removeCard( card );
			this.hands[ from ].addCard( card );
			askingPlayer.hand = this.hands[ by ];
			askedPlayer.hand = this.hands[ from ];

			return {
				result: "CARD_TRANSFER",
				success: true,
				description: `${ askedPlayer.name } gave ${ card.cardString } to ${ askingPlayer.name }`
			};

		} else {
			this.currentTurn = askedPlayer.id;
			return {
				result: "CARD_TRANSFER",
				success: false,
				description: `${ askedPlayer.name } declined ${ card.cardString } to ${ askingPlayer.name }`
			};
		}
	}
}
