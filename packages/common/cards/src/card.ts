import { UPPER_CARD_RANKS } from "./constants.ts";
import { CardRank, CardSet, CardSuit, type IPlayingCard } from "./types.ts";

export class PlayingCard implements IPlayingCard {
	readonly rank: CardRank;
	readonly suit: CardSuit;
	readonly set: CardSet;
	readonly id: string;
	readonly displayString: string;

	private constructor( rank: CardRank, suit: CardSuit ) {
		this.rank = rank;
		this.suit = suit;

		const isUpper = UPPER_CARD_RANKS.includes( this.rank );

		switch ( this.suit ) {
			case CardSuit.HEARTS:
				this.set = isUpper ? CardSet.UPPER_HEARTS : CardSet.LOWER_HEARTS;
				break;
			case CardSuit.CLUBS:
				this.set = isUpper ? CardSet.UPPER_CLUBS : CardSet.LOWER_CLUBS;
				break;
			case CardSuit.DIAMONDS:
				this.set = isUpper ? CardSet.UPPER_DIAMONDS : CardSet.LOWER_DIAMONDS;
				break;
			case CardSuit.SPADES:
				this.set = isUpper ? CardSet.UPPER_SPADES : CardSet.LOWER_SPADES;
				break;
		}

		this.id = this.rank.concat( "Of" ).concat( this.suit );
		this.displayString = this.rank.concat( " of " ).concat( this.suit );
	}

	static from( { rank, suit }: IPlayingCard ) {
		return new PlayingCard( rank, suit );
	}

	static fromId( id: string ) {
		const rank = id.split( "Of" )[ 0 ] as CardRank;
		const suit = id.split( "Of" )[ 1 ] as CardSuit;
		return new PlayingCard( rank, suit );
	}
}