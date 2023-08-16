import type { ICallbreakRound } from "./round";
import { CallbreakRound } from "./round";
import type { CardSuit, PlayingCard } from "@s2h/cards";

export enum CallbreakDealStatus {
	CREATED = "CREATED",
	WINS_DECLARED = "WINS_DECLARED",
	IN_PROGRESS = "IN_PROGRESS",
	COMPLETED = "COMPLETED"
}

export interface ICallbreakDeal {
	gameId: string;
	trumpSuit: CardSuit;
	status: CallbreakDealStatus;
	declaration: Record<string, number>;
	scores: Record<string, number>;
	rounds: Record<string, ICallbreakRound>;
}

export class CallbreakDeal implements ICallbreakDeal {
	readonly id: string;
	readonly gameId: string;
	readonly trumpSuit: CardSuit;

	status: CallbreakDealStatus;
	readonly rounds: Record<string, CallbreakRound> = {};
	readonly declaration: Record<string, number> = {};
	readonly scores: Record<string, number> = {};

	private constructor( data: ICallbreakDeal & { id: string } ) {
		this.id = data.id;
		this.gameId = data.gameId;
		this.trumpSuit = data.trumpSuit;
		this.declaration = data.declaration;
		this.scores = data.scores;
		this.status = data.status;

		Object.keys( data.rounds ).map( roundId => {
			this.rounds[ roundId ] = CallbreakRound.from( data.rounds[ roundId ] );
		} );
	}

	get playerIds() {
		return Object.keys( this.scores );
	}

	get roundList() {
		return Object.values( this.rounds );
	}

	static createNew( id: string, gameId: string, trumpSuit: CardSuit ) {
		return new CallbreakDeal( {
			id,
			gameId,
			trumpSuit,
			declaration: {},
			scores: {},
			status: CallbreakDealStatus.CREATED,
			rounds: {}
		} );
	}

	static from( data: ICallbreakDeal & { id: string } ) {
		return new CallbreakDeal( data );
	}

	recordDeclaration( playerId: string, winsDeclared: number ) {
		this.declaration[ playerId ] = winsDeclared;
		if ( Object.keys( this.declaration ).length === 4 ) {
			this.status = CallbreakDealStatus.WINS_DECLARED;
		}
	}

	startRound( id: string, playerId: string, card: PlayingCard ) {
		const round = CallbreakRound.createNew( id, playerId, card.suit, this.trumpSuit );
		round.recordPlayerMove( { playerId, card } );
		this.rounds[ round.id ] = round;
	}

	recordRoundMove( id: string, playerId: string, card: PlayingCard ) {
		this.rounds[ id ].recordPlayerMove( { playerId, card } );
	}

	computeScores() {
		Object.keys( this.declaration ).forEach( playerId => {
			const winsDeclared = this.declaration[ playerId ];
			const actualWins = this.roundList.filter( round => round.winner === playerId ).length;

			if ( winsDeclared === actualWins ) {
				this.scores[ playerId ] = 10 * winsDeclared;
			} else if ( winsDeclared > actualWins ) {
				this.scores[ playerId ] = -10 * winsDeclared;
			} else {
				const bonusWins = winsDeclared - actualWins;
				this.scores[ playerId ] = 10 * winsDeclared + 2 * bonusWins;
			}
		} );
	}

	serialize(): ICallbreakDeal {
		const { gameId, trumpSuit, declaration, rounds, scores, status } = this;
		return { gameId, declaration, trumpSuit, rounds, scores, status };
	}
}