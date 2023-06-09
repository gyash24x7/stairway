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
	SMALL_DIAMONDS = "Small Diamonds",
	BIG_DIAMONDS = "Big Diamonds",
	SMALL_HEARTS = "Small Hearts",
	BIG_HEARTS = "Big Hearts",
	SMALL_SPADES = "Small Spades",
	BIG_SPADES = "Big Spades",
	SMALL_CLUBS = "Small Clubs",
	BIG_CLUBS = "Big Clubs"
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
	CardSet.BIG_DIAMONDS,
	CardSet.BIG_CLUBS,
	CardSet.BIG_SPADES,
	CardSet.BIG_HEARTS,
	CardSet.SMALL_CLUBS,
	CardSet.SMALL_DIAMONDS,
	CardSet.SMALL_SPADES,
	CardSet.SMALL_HEARTS
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
	[ CardSet.SMALL_CLUBS ]: cardSuitMap[ CardSuit.CLUBS ].slice( 0, 6 ),
	[ CardSet.SMALL_SPADES ]: cardSuitMap[ CardSuit.SPADES ].slice( 0, 6 ),
	[ CardSet.SMALL_DIAMONDS ]: cardSuitMap[ CardSuit.DIAMONDS ].slice( 0, 6 ),
	[ CardSet.SMALL_HEARTS ]: cardSuitMap[ CardSuit.HEARTS ].slice( 0, 6 ),
	[ CardSet.BIG_CLUBS ]: cardSuitMap[ CardSuit.CLUBS ].slice( 7 ),
	[ CardSet.BIG_SPADES ]: cardSuitMap[ CardSuit.SPADES ].slice( 7 ),
	[ CardSet.BIG_DIAMONDS ]: cardSuitMap[ CardSuit.DIAMONDS ].slice( 7 ),
	[ CardSet.BIG_HEARTS ]: cardSuitMap[ CardSuit.HEARTS ].slice( 7 )
};