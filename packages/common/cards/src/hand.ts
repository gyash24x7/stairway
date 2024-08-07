import { PlayingCard } from "./card.ts";
import { cardSetMap, SORTED_DECK } from "./constants.ts";
import { CardRank, CardSet, CardSuit, type IPlayingCard } from "./types.ts";
import { chunk, shuffle } from "./utils.ts";

export class CardHand {
	readonly cards: PlayingCard[];

	protected constructor( cards: PlayingCard[] ) {
		this.cards = cards;
	}

	get sets() {
		return new Set( this.cards.map( card => card.set ) );
	}

	get suits() {
		return new Set( this.cards.map( card => card.suit ) );
	}

	static from( cards: PlayingCard[] ) {
		return new CardHand( cards );
	}

	static empty() {
		return new CardHand( [] )
	}

	isEmpty() {
		return this.cards.length === 0;
	}

	isCardSetInHand( set: CardSet ) {
		return this.sets.has( set );
	}

	getCardsOfSet( set: CardSet ) {
		return this.cards.filter( card => card.set === set );
	}

	getCardsOfSuit( suit: CardSuit ) {
		return this.cards.filter( card => card.suit === suit );
	}

	getAskableCardsOfSet( set: CardSet ) {
		return cardSetMap[ set ].map( PlayingCard.from )
			.filter( card => !this.cards.map( c => c.id ).includes( card.id ) );
	}

	sorted() {
		const cardIds = this.cards.map( card => card.id );
		return SORTED_DECK.map( PlayingCard.from ).filter( card => cardIds.includes( card.id ) );
	}

	serialize(): IPlayingCard[] {
		return this.cards;
	}
}

export class CardDeck {
	cards = shuffle( SORTED_DECK.map( PlayingCard.from ) );

	removeCardsOfRank( rank: CardRank ) {
		this.cards = this.cards.filter( card => card.rank !== rank );
	}

	generateHandsFromCards( handCount: number ) {
		if ( this.cards.length % handCount !== 0 ) {
			return [];
		}

		const handSize = this.cards.length / handCount;
		return chunk( this.cards, handSize );
	}
}