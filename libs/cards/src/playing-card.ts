import type { CardRank } from "./card-const";
import { BIG_CARD_RANKS, CardSet, CardSuit } from "./card-const";
import { Expose, instanceToPlain, plainToInstance } from "class-transformer";

export class PlayingCard {
	@Expose() readonly rank: CardRank;
	@Expose() readonly suit: CardSuit;

	constructor( rank: CardRank, suit: CardSuit ) {
		this.rank = rank;
		this.suit = suit;
	}

	get set() {
		switch ( this.suit ) {
			case CardSuit.CLUBS:
				return BIG_CARD_RANKS.includes( this.rank ) ? CardSet.BIG_CLUBS : CardSet.SMALL_CLUBS;
			case CardSuit.HEARTS:
				return BIG_CARD_RANKS.includes( this.rank ) ? CardSet.BIG_HEARTS : CardSet.SMALL_HEARTS;
			case CardSuit.DIAMONDS:
				return BIG_CARD_RANKS.includes( this.rank ) ? CardSet.BIG_DIAMONDS : CardSet.SMALL_DIAMONDS;
			case CardSuit.SPADES:
				return BIG_CARD_RANKS.includes( this.rank ) ? CardSet.BIG_SPADES : CardSet.SMALL_SPADES;
		}
	}

	get cardString() {
		return `${ this.rank } of ${ this.suit }`
	}

	get id() {
		return `${ this.rank }Of${ this.suit }`;
	}

	static from( card: Record<string, any> ) {
		return plainToInstance( PlayingCard, card );
	}

	serialize() {
		return instanceToPlain( this );
	}
}