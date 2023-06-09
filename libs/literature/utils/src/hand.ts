import { CardHand, CardSet, ICardHand } from "@s2h/cards";

export interface ILiteratureGameHand {
	id: string;
	gameId: string;
	playerId: string;
	hand: ICardHand;
}

export class LiteratureGameHand implements ILiteratureGameHand {
	id: string;
	gameId: string;
	playerId: string;
	hand: CardHand;

	private constructor( id: string, gameId: string, playerId: string, hand: ICardHand ) {
		this.id = id;
		this.gameId = gameId;
		this.playerId = playerId;
		this.hand = CardHand.from( hand );
	}

	static from( { id, gameId, playerId, hand }: ILiteratureGameHand ) {
		return new LiteratureGameHand( id, gameId, playerId, hand );
	}

	removeCardsOfSet( set: CardSet ) {
		return this.hand.removeCardsOfSet( set );
	}

	serialize(): ILiteratureGameHand {
		return JSON.parse( JSON.stringify( this ) );
	}
}