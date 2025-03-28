import { CARD_RANKS, UPPER_CARD_RANKS } from "@/libs/cards/constants";
import { CardRank, CardSet, CardSuit, type PlayingCard } from "@/libs/cards/types";

export function getCardSet( card: PlayingCard ) {
	switch ( card.suit ) {
		case CardSuit.HEARTS:
			return UPPER_CARD_RANKS.includes( card.rank ) ? CardSet.UPPER_HEARTS : CardSet.LOWER_HEARTS;
		case CardSuit.CLUBS:
			return UPPER_CARD_RANKS.includes( card.rank ) ? CardSet.UPPER_CLUBS : CardSet.LOWER_CLUBS;
		case CardSuit.DIAMONDS:
			return UPPER_CARD_RANKS.includes( card.rank ) ? CardSet.UPPER_DIAMONDS : CardSet.LOWER_DIAMONDS;
		case CardSuit.SPADES:
			return UPPER_CARD_RANKS.includes( card.rank ) ? CardSet.UPPER_SPADES : CardSet.LOWER_SPADES;
	}
}

export function getCardId( card: PlayingCard ) {
	return card.rank.concat( "Of" ).concat( card.suit );
}

export function getCardDisplayString( card: PlayingCard ) {
	return card.rank.concat( " of " ).concat( card.suit );
}

export function compareCards( card1: PlayingCard, card2: PlayingCard ) {
	if ( card1.suit !== card2.suit ) {
		return false;
	}

	if ( card2.rank === CardRank.ACE ) {
		return false;
	}

	if ( card1.rank === CardRank.ACE ) {
		return true;
	}

	return CARD_RANKS.indexOf( card1.rank ) > CARD_RANKS.indexOf( card2.rank );
}

export function getCardFromId( id: string ) {
	const rank = id.split( "Of" )[ 0 ] as CardRank;
	const suit = id.split( "Of" )[ 1 ] as CardSuit;
	return { rank, suit } as PlayingCard;
}
