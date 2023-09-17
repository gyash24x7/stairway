import { BIG_CARD_RANKS, CardRank, CardSet, CardSuit } from "./card-const";

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

	get cardSet() {
		switch ( this.suit ) {
			case CardSuit.CLUBS:
				return BIG_CARD_RANKS.includes( this.rank ) ? CardSet.UPPER_CLUBS : CardSet.LOWER_CLUBS;
			case CardSuit.HEARTS:
				return BIG_CARD_RANKS.includes( this.rank ) ? CardSet.UPPER_HEARTS : CardSet.LOWER_HEARTS;
			case CardSuit.DIAMONDS:
				return BIG_CARD_RANKS.includes( this.rank ) ? CardSet.UPPER_DIAMONDS : CardSet.LOWER_DIAMONDS;
			case CardSuit.SPADES:
				return BIG_CARD_RANKS.includes( this.rank ) ? CardSet.UPPER_SPADES : CardSet.LOWER_SPADES;
		}
	}

	get cardString() {
		return `${ this.rank } of ${ this.suit }`;
	}

	get cardId() {
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

	serialize(): IPlayingCard {
		return { rank: this.rank, suit: this.suit };
	}
}