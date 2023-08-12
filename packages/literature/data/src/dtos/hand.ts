import { CardHand, CardSet, ICardHand } from "@s2h/cards";

export interface ILiteratureGameHand {
	gameId: string;
	playerId: string;
	initialHand: ICardHand;
	hand: ICardHand;
}

export class LiteratureGameHand implements ILiteratureGameHand {
	id: string;
	gameId: string;
	playerId: string;
	initialHand: CardHand;
	hand: CardHand;

	private constructor( data: ILiteratureGameHand & { id: string } ) {
		this.id = data.id;
		this.gameId = data.gameId;
		this.playerId = data.playerId;
		this.initialHand = CardHand.from( data.initialHand );
		this.hand = CardHand.from( data.hand );
	}

	static create( id: string, playerId: string, gameId: string, hand: CardHand ) {
		return new LiteratureGameHand( { id, playerId, gameId, initialHand: hand.serialize(), hand } );
	}

	removeCardsOfSet( set: CardSet ) {
		return this.hand.removeCardsOfSet( set );
	}

	serialize(): ILiteratureGameHand {
		const { gameId, initialHand, hand, playerId } = this;
		return { gameId, initialHand: initialHand.serialize(), hand: hand.serialize(), playerId };
	}
}