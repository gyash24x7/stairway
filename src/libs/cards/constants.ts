import type { CardId, PlayingCard } from "@/libs/cards/types";

export const CARD_RANKS = {
	ACE: "A",
	TWO: "2",
	THREE: "3",
	FOUR: "4",
	FIVE: "5",
	SIX: "6",
	SEVEN: "7",
	EIGHT: "8",
	NINE: "9",
	TEN: "10",
	JACK: "J",
	QUEEN: "Q",
	KING: "K"
} as const;

export const CARD_SUITS = { CLUBS: "C", SPADES: "S", HEARTS: "H", DIAMONDS: "D" } as const;

export const SORTED_DECK: PlayingCard[] = Object.values( CARD_SUITS ).flatMap(
	suit => Object.values( CARD_RANKS ).map( rank => ( { rank, suit } ) )
);

export const CARD_IDS: CardId[] = Object.values( CARD_RANKS )
	.flatMap( rank => Object.values( CARD_SUITS ).map( suit => `${ rank }${ suit }` as const ) );