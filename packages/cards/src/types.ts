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

export interface IPlayingCard {
	rank: CardRank;
	suit: CardSuit;
}
