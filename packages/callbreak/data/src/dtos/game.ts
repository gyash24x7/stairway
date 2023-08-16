import type { ICallbreakPlayer } from "./player";
import { CallbreakPlayer } from "./player";
import { CardDeck, CardHand, CardSuit, generateGameCode } from "@s2h/cards";
import type { UserAuthInfo } from "@auth/data";
import { CallbreakDeal } from "./deal";

export enum CallbreakGameStatus {
	CREATED = "CREATED",
	DEAL_AWAITED = "DEAL_AWAITED",
	IN_PROGRESS = "IN_PROGRESS",
	COMPLETED = "COMPLETED"
}

export interface ICallbreakGame {
	code: string;
	status: CallbreakGameStatus;
	trumpSuit: CardSuit;
	createdBy: string;
	players: Record<string, ICallbreakPlayer>;
	scores: Record<string, number>;
}

export class CallbreakGame implements ICallbreakGame {
	readonly id: string;
	readonly code: string;
	readonly trumpSuit: CardSuit;
	readonly createdBy: string;

	status: CallbreakGameStatus;
	readonly scores: Record<string, number> = {};
	readonly players: Record<string, CallbreakPlayer> = {};

	private constructor( data: ICallbreakGame & { id: string } ) {
		this.id = data.id;
		this.code = data.code;
		this.trumpSuit = data.trumpSuit;
		this.createdBy = data.createdBy;
		this.status = data.status;
		this.scores = data.scores;

		Object.values( data.players ).forEach( player => {
			this.players[ player.id ] = CallbreakPlayer.from( player );
		} );
	}

	get playerIds() {
		return Object.keys( this.players );
	}

	get playerList() {
		return Object.values( this.players );
	}

	static createNew( id: string, trumpSuit: CardSuit, authInfo: UserAuthInfo ) {
		return new CallbreakGame( {
			id,
			trumpSuit,
			createdBy: authInfo.id,
			scores: {},
			players: {},
			status: CallbreakGameStatus.CREATED,
			code: generateGameCode()
		} );
	}

	static from( data: ICallbreakGame & { id: string } ) {
		return new CallbreakGame( data );
	}

	addPlayers( ...players: CallbreakPlayer[] ) {
		players.forEach( player => {
			this.players[ player.id ] = player;
		} );

		if ( this.playerList.length === 4 ) {
			this.status = CallbreakGameStatus.DEAL_AWAITED;
		}
	}

	isUserAlreadyInGame( id: string ) {
		return !!this.players[ id ];
	}

	updateScores( deal: CallbreakDeal ) {
		Object.keys( deal.scores ).map( playerId => {
			this.scores[ playerId ] += deal.scores[ playerId ];
		} );
	}

	createDeal( id: string ) {
		const deal = CallbreakDeal.createNew( id, this.id, this.trumpSuit );
		const deck = new CardDeck();
		const hands = deck.generateHands( 4 );
		const handData: Record<string, CardHand> = {};

		this.playerList.forEach( ( player, i ) => {
			handData[ player.id ] = hands[ i ];
		} );

		return [ deal, handData ] as const;
	}

	serialize(): ICallbreakGame {
		const { code, createdBy, players, scores, trumpSuit, status } = this;
		return { code, createdBy, players, scores, status, trumpSuit };
	}
}