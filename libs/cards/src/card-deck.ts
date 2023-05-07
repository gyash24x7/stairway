import { chunk, remove, shuffle } from "lodash";
import type { CardRank } from "./card-const";
import { SORTED_DECK } from "./card-const";
import { CardHand } from "./card-hand";
import type { IPlayingCard } from "./playing-card";

export interface ICardDeck {
	cards: IPlayingCard[];
}

export class CardDeck implements ICardDeck {
	cards = shuffle( SORTED_DECK );

	get length() {
		return this.cards.length;
	}

	removeCardsOfRank( rank: CardRank ) {
		remove( this.cards, [ "rank", rank ] );
	}

	generateHands( handCount: number ): CardHand[] {
		if ( this.length % handCount !== 0 ) {
			return [];
		}

		const handSize = this.cards.length / handCount;
		return chunk( this.cards, handSize ).map( cards => CardHand.from( { cards } ) );
	}

	sort() {
		this.cards = SORTED_DECK;
	}
}