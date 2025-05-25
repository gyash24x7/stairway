import { CardRank, CardSet, CardSuit, type PlayingCard } from "@/shared/cards/types";

export const CARD_RANKS = [
	CardRank.ACE,
	CardRank.TWO,
	CardRank.THREE,
	CardRank.FOUR,
	CardRank.FIVE,
	CardRank.SIX,
	CardRank.SEVEN,
	CardRank.EIGHT,
	CardRank.NINE,
	CardRank.TEN,
	CardRank.JACK,
	CardRank.QUEEN,
	CardRank.KING
] as const;

export const LOWER_CARD_RANKS = CARD_RANKS.slice( 0, 6 );
export const UPPER_CARD_RANKS = CARD_RANKS.slice( 6 );

export const CARD_SUITS = [ CardSuit.HEARTS, CardSuit.CLUBS, CardSuit.DIAMONDS, CardSuit.SPADES ] as const;

export const CARD_SETS = [
	CardSet.LOWER_CLUBS,
	CardSet.UPPER_CLUBS,
	CardSet.LOWER_SPADES,
	CardSet.UPPER_SPADES,
	CardSet.LOWER_DIAMONDS,
	CardSet.UPPER_DIAMONDS,
	CardSet.LOWER_HEARTS,
	CardSet.UPPER_HEARTS
] as const;

export const SORTED_DECK: PlayingCard[] = CARD_SUITS.flatMap(
	suit => CARD_RANKS.map( rank => ( { rank, suit } ) )
);

export const cardSuitMap: Record<CardSuit, PlayingCard[]> = {
	[ CardSuit.CLUBS ]: SORTED_DECK.filter( card => card.suit === CardSuit.CLUBS ),
	[ CardSuit.SPADES ]: SORTED_DECK.filter( card => card.suit === CardSuit.SPADES ),
	[ CardSuit.HEARTS ]: SORTED_DECK.filter( card => card.suit === CardSuit.HEARTS ),
	[ CardSuit.DIAMONDS ]: SORTED_DECK.filter( card => card.suit === CardSuit.DIAMONDS )
};

export const cardSetMap: Record<CardSet, PlayingCard[]> = {
	[ CardSet.LOWER_CLUBS ]: cardSuitMap[ CardSuit.CLUBS ].slice( 0, 6 ),
	[ CardSet.UPPER_CLUBS ]: cardSuitMap[ CardSuit.CLUBS ].slice( 7 ),
	[ CardSet.LOWER_SPADES ]: cardSuitMap[ CardSuit.SPADES ].slice( 0, 6 ),
	[ CardSet.UPPER_SPADES ]: cardSuitMap[ CardSuit.SPADES ].slice( 7 ),
	[ CardSet.LOWER_DIAMONDS ]: cardSuitMap[ CardSuit.DIAMONDS ].slice( 0, 6 ),
	[ CardSet.UPPER_DIAMONDS ]: cardSuitMap[ CardSuit.DIAMONDS ].slice( 7 ),
	[ CardSet.LOWER_HEARTS ]: cardSuitMap[ CardSuit.HEARTS ].slice( 0, 6 ),
	[ CardSet.UPPER_HEARTS ]: cardSuitMap[ CardSuit.HEARTS ].slice( 7 )
};
