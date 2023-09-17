import type { CardRank } from "./card-const";
import { SORTED_DECK } from "./card-const";
import { CardHand } from "./card-hand";
import { chunk, shuffle } from "./card-utils";

export class CardDeck {
	private _cards = shuffle( SORTED_DECK );

	get cards() {
		return this._cards;
	}

	get length() {
		return this._cards.length;
	}

	removeCardsOfRank( rank: CardRank ) {
		this._cards = this._cards.filter( card => card.rank !== rank );
	}

	generateHands( handCount: number ): CardHand[] {
		if ( this.length % handCount !== 0 ) {
			return [];
		}

		const handSize = this._cards.length / handCount;
		return chunk( this._cards, handSize ).map( CardHand.create );
	}

	sort() {
		this._cards = SORTED_DECK.filter( card => this._cards.includes( card ) );
	}
}