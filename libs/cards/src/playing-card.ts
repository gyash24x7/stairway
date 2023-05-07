import type { CardRank } from "./card-const";
import { BIG_CARD_RANKS, CardSet, CardSuit } from "./card-const";

export interface IPlayingCard {
	rank: CardRank;
	suit: CardSuit;
}

export class PlayingCard implements IPlayingCard {
	readonly rank: CardRank;
	readonly suit: CardSuit;

	private constructor( rank: CardRank, suit: CardSuit ) {
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
		return `${ this.rank } of ${ this.suit }`;
	}

	get id() {
		return `${ this.rank }Of${ this.suit }`;
	}

	static from( card: IPlayingCard ) {
		return new PlayingCard( card.rank, card.suit );
	}

	static fromId( id: string ) {
		const rank = id.split( "Of" )[ 0 ] as CardRank;
		const suit = id.split( "Of" )[ 1 ] as CardSuit;
		return new PlayingCard( rank, suit );
	}

	serialize() {
		return JSON.parse( JSON.stringify( this ) );
	}
}