import { CardHand, CardSet, ICardHand } from "@s2h/cards";

export interface ICallbreakHand {
	gameId: string;
	dealId: string;
	playerId: string;
	hand: ICardHand;
}

export class CallbreakHand implements ICallbreakHand {
	id: string;
	gameId: string;
	dealId: string;
	playerId: string;
	hand: CardHand;

	private constructor( data: ICallbreakHand & { id: string } ) {
		this.id = data.id;
		this.gameId = data.gameId;
		this.dealId = data.dealId;
		this.playerId = data.playerId;
		this.hand = CardHand.from( data.hand );
	}

	static create( id: string, gameId: string, dealId: string, playerId: string, hand: CardHand ) {
		return new CallbreakHand( { id, playerId, gameId, hand, dealId } );
	}

	removeCardsOfSet( set: CardSet ) {
		return this.hand.removeCardsOfSet( set );
	}

	serialize(): ICallbreakHand {
		const { gameId, hand, playerId, dealId } = this;
		return { gameId, hand: hand.serialize(), playerId, dealId };
	}
}