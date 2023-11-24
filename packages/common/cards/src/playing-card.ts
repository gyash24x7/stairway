import { CardRank, CardSet, CardSuit, UPPER_CARD_RANKS } from "./card-const.js";

export type PlayingCard = {
	id: string;
	rank: CardRank;
	suit: CardSuit;
	set: CardSet;
	displayString: string;
}

export function getPlayingCardFromId( id: string ): PlayingCard {
	const rank = id.split( "Of" )[ 0 ] as CardRank;
	const suit = id.split( "Of" )[ 1 ] as CardSuit;
	const displayString = `${ rank } of ${ suit }`;

	const isUpper = UPPER_CARD_RANKS.includes( rank );

	switch ( suit ) {
		case CardSuit.CLUBS:
			return { id, rank, suit, set: isUpper ? CardSet.UPPER_CLUBS : CardSet.LOWER_CLUBS, displayString };
		case CardSuit.HEARTS:
			return { id, rank, suit, set: isUpper ? CardSet.UPPER_HEARTS : CardSet.LOWER_HEARTS, displayString };
		case CardSuit.DIAMONDS:
			return { id, rank, suit, set: isUpper ? CardSet.UPPER_DIAMONDS : CardSet.LOWER_DIAMONDS, displayString };
		case CardSuit.SPADES:
			return { id, rank, suit, set: isUpper ? CardSet.UPPER_SPADES : CardSet.LOWER_SPADES, displayString };
	}
}

export function getPlayingCardFromRankAndSuit( rank: CardRank, suit: CardSuit ) {
	const id = `${ rank }Of${ suit }`;
	return getPlayingCardFromId( id );
}
