import { PlayingCard } from "./playing-card";

export enum CardRank {
	ACE = "Ace",
	TWO = "Two",
	THREE = "Three",
	FOUR = "Four",
	FIVE = "Five",
	SIX = "Six",
	SEVEN = "Seven",
	EIGHT = "Eight",
	NINE = "Nine",
	TEN = "Ten",
	JACK = "Jack",
	QUEEN = "Queen",
	KING = "King"
}

export enum CardSuit {
	HEARTS = "Hearts",
	SPADES = "Spades",
	CLUBS = "Clubs",
	DIAMONDS = "Diamonds"
}

export enum CardSet {
	LOWER_DIAMONDS = "Lower Diamonds",
	UPPER_DIAMONDS = "Upper Diamonds",
	LOWER_HEARTS = "Lower Hearts",
	UPPER_HEARTS = "Upper Hearts",
	LOWER_SPADES = "Lower Spades",
	UPPER_SPADES = "Upper Spades",
	LOWER_CLUBS = "Lower Clubs",
	UPPER_CLUBS = "Upper Clubs"
}

export const SMALL_CARD_RANKS = [
	CardRank.ACE,
	CardRank.TWO,
	CardRank.THREE,
	CardRank.FOUR,
	CardRank.FIVE,
	CardRank.SIX
];

export const BIG_CARD_RANKS = [
	CardRank.SEVEN,
	CardRank.EIGHT,
	CardRank.NINE,
	CardRank.TEN,
	CardRank.JACK,
	CardRank.QUEEN,
	CardRank.KING
];

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

export const CARD_SUITS = [ CardSuit.HEARTS, CardSuit.CLUBS, CardSuit.DIAMONDS, CardSuit.SPADES ] as const;

export const CARD_SETS = [
	CardSet.UPPER_DIAMONDS,
	CardSet.UPPER_CLUBS,
	CardSet.UPPER_SPADES,
	CardSet.UPPER_HEARTS,
	CardSet.LOWER_CLUBS,
	CardSet.LOWER_DIAMONDS,
	CardSet.LOWER_SPADES,
	CardSet.LOWER_HEARTS
] as const;

export const SORTED_DECK: PlayingCard[] = CARD_SUITS.flatMap(
	suit => CARD_RANKS.map( rank => PlayingCard.from( { rank, suit } ) )
);

export const cardSuitMap: Record<CardSuit, PlayingCard[]> = {
	[ CardSuit.CLUBS ]: SORTED_DECK.filter( card => card.suit === CardSuit.CLUBS ),
	[ CardSuit.SPADES ]: SORTED_DECK.filter( card => card.suit === CardSuit.SPADES ),
	[ CardSuit.HEARTS ]: SORTED_DECK.filter( card => card.suit === CardSuit.HEARTS ),
	[ CardSuit.DIAMONDS ]: SORTED_DECK.filter( card => card.suit === CardSuit.DIAMONDS )
};

export const cardSetMap: Record<CardSet, PlayingCard[]> = {
	[ CardSet.LOWER_CLUBS ]: cardSuitMap[ CardSuit.CLUBS ].slice( 0, 6 ),
	[ CardSet.LOWER_SPADES ]: cardSuitMap[ CardSuit.SPADES ].slice( 0, 6 ),
	[ CardSet.LOWER_DIAMONDS ]: cardSuitMap[ CardSuit.DIAMONDS ].slice( 0, 6 ),
	[ CardSet.LOWER_HEARTS ]: cardSuitMap[ CardSuit.HEARTS ].slice( 0, 6 ),
	[ CardSet.UPPER_CLUBS ]: cardSuitMap[ CardSuit.CLUBS ].slice( 7 ),
	[ CardSet.UPPER_SPADES ]: cardSuitMap[ CardSuit.SPADES ].slice( 7 ),
	[ CardSet.UPPER_DIAMONDS ]: cardSuitMap[ CardSuit.DIAMONDS ].slice( 7 ),
	[ CardSet.UPPER_HEARTS ]: cardSuitMap[ CardSuit.HEARTS ].slice( 7 )
};