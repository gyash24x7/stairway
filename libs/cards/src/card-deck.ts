import type { IPlayingCard, PlayingCard } from "./playing-card";
import { CardHand } from "./card-hand";
import type { CardRank } from "./card-const";
import { SORTED_DECK } from "./card-const";

export interface ICardDeck {
	cards: IPlayingCard[];
}

export class CardDeck implements ICardDeck {
	cards: PlayingCard[] = [];

	constructor() {
		let deck = [ ...SORTED_DECK ];
		for ( let i = deck.length; i > 1; i-- ) {
			let j = Math.floor( Math.random() * i );
			[ deck[ i - 1 ], deck[ j ] ] = [ deck[ j ], deck[ i - 1 ] ];
		}

		this.cards = deck;
	}

	get length() {
		return this.cards.length;
	}

	removeCardsOfRank( rank: CardRank ) {
		this.cards = this.cards.filter( ( card ) => card.rank !== rank );
	}

	generateHands( handCount: number ) {
		const handSize = this.cards.length / handCount;
		return [ ...Array( handCount ) ]
			.map( ( _, i ) => this.cards.slice( handSize * i, handSize * i + handSize ) )
			.map( cards => CardHand.from( { cards } ) );
	}
}