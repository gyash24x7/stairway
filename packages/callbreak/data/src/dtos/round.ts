import type { CardSuit, IPlayingCard } from "@s2h/cards";
import { cardSuitMap, PlayingCard } from "@s2h/cards";

export interface ICallbreakMove {
	playerId: string;
	card: IPlayingCard;
}

export class CallbreakMove implements ICallbreakMove {
	playerId: string;
	card: PlayingCard;

	private constructor( data: ICallbreakMove ) {
		this.playerId = data.playerId;
		this.card = PlayingCard.from( data.card );
	}

	static from( data: ICallbreakMove ) {
		return new CallbreakMove( data );
	}
}

export enum CallbreakRoundStatus {
	CREATED = "CREATED",
	IN_PROGRESS = "IN_PROGRESS",
	COMPLETED = "COMPLETED"
}

export interface ICallbreakRound {
	id: string;
	suit: CardSuit;
	trumpSuit: CardSuit;
	status: CallbreakRoundStatus;
	moves: ICallbreakMove[];
	winner?: string;
	currentTurn: string;
}

export class CallbreakRound implements ICallbreakRound {
	readonly id: string;
	readonly suit: CardSuit;
	readonly trumpSuit: CardSuit;

	status: CallbreakRoundStatus;
	moves: CallbreakMove[] = [];
	winner?: string;
	currentTurn: string;

	private constructor( data: ICallbreakRound ) {
		this.id = data.id;
		this.suit = data.suit;
		this.trumpSuit = data.trumpSuit;
		this.status = data.status;
		this.moves = data.moves.map( CallbreakMove.from );
		this.winner = data.winner;
		this.currentTurn = data.currentTurn;
	}

	get movesOfDeclaredSuit() {
		return this.getMovesOfSuit( this.suit );
	}

	get trumpMoves() {
		return this.getMovesOfSuit( this.trumpSuit );
	}

	get cards() {
		return this.moves.map( move => move.card );
	}

	static createNew( id: string, playerId: string, suit: CardSuit, trumpSuit: CardSuit ) {
		return new CallbreakRound( {
			id,
			suit,
			moves: [],
			trumpSuit,
			currentTurn: playerId,
			status: CallbreakRoundStatus.CREATED
		} );
	}

	static from( data: ICallbreakRound ) {
		return new CallbreakRound( data );
	}

	recordPlayerMove( move: CallbreakMove ) {
		this.moves.push( move );
		if ( this.trumpMoves.length === 0 ) {
			this.winner = this.movesOfDeclaredSuit[ 0 ].playerId;
		} else {
			this.winner = this.trumpMoves[ 0 ].playerId;
		}

		if ( this.moves.length === 4 ) {
			this.status = CallbreakRoundStatus.COMPLETED;
		}
	}

	getMovesOfSuit( suit: CardSuit ) {
		const moves = this.moves.filter( move => move.card.suit === suit );
		const sortedCards = cardSuitMap[ suit ];
		moves.sort( ( a, b ) => sortedCards.indexOf( b.card ) - sortedCards.indexOf( a.card ) );
		return moves;
	}

	serialize(): ICallbreakRound {
		const { id, suit, status, moves, winner, trumpSuit, currentTurn } = this;
		return { id, suit, moves, status, winner, trumpSuit, currentTurn };
	}
}