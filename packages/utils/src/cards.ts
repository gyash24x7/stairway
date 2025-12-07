import { chunk, shuffle } from "./array.ts";

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

export type CardRank = typeof CARD_RANKS[keyof typeof CARD_RANKS];
export type CardSuit = typeof CARD_SUITS[keyof typeof CARD_SUITS];

export type CardId = `${ CardRank }${ CardSuit }`;

export const SORTED_DECK: CardId[] = Object.values( CARD_SUITS ).flatMap(
	suit => Object.values( CARD_RANKS ).map( rank => ( rank + suit ) as CardId )
);

export const CARD_IDS = Object.values( CARD_RANKS )
	.flatMap( rank => Object.values( CARD_SUITS ).map( suit => `${ rank }${ suit }` as const ) );

/**
 * Gets the card rank from a card identifier.
 * @param card Card identifier string (e.g., "AH" for Ace of Hearts)
 * @returns The rank of the card (e.g., "A" for Ace)
 */
export function getCardRank( card: CardId ) {
	return card.slice( 0, card.length - 1 ) as CardRank;
}

/**
 * Gets the card suit from a card identifier.
 * @param card Card identifier string (e.g., "AH" for Ace of Hearts)
 * @returns The suit of the card (e.g., "H" for Hearts)
 */
export function getCardSuit( card: CardId ) {
	return card.charAt( card.length - 1 ) as CardSuit;
}

/**
 * Generates a display string for a playing card.
 * The display string is formatted as "RANK OF SUIT".
 *
 * @param card Card identifier string (e.g., "AH" for Ace of Hearts)
 * @returns Display string for the card
 */
export function getCardDisplayString( card: CardId ) {
	const rank = getCardRank( card );
	const suit = getCardSuit( card );

	const rankDisplay = Object.keys( CARD_RANKS ).map( k => k as keyof typeof CARD_RANKS )
		.find( key => CARD_RANKS[ key ] === rank )!;

	const suitDisplay = Object.keys( CARD_SUITS ).map( k => k as keyof typeof CARD_SUITS )
		.find( key => CARD_SUITS[ key ] === suit )!;

	return `${ rankDisplay } OF ${ suitDisplay }`;
}

/**
 * Returns a sorted version of a hand based on the predefined sorted deck.
 * This function ensures that the cards in the hand are returned in the same order as they appear in the sorted deck.
 *
 * @param hand Array of PlayingCard objects representing the hand
 * @returns Sorted array of PlayingCard objects
 */
export function getSortedHand( hand: CardId[] ) {
	return SORTED_DECK.filter( card => hand.includes( card ) );
}

/**
 * Generates a shuffled deck of playing cards.
 * The deck is created from the predefined sorted deck and then shuffled.
 *
 * @returns Shuffled array of PlayingCard objects
 */
export function generateDeck() {
	return shuffle( SORTED_DECK );
}

/**
 * Generates hands from a deck of playing cards.
 * The deck is divided into equal parts based on the number of hands specified.
 * If the deck cannot be evenly divided, an empty array is returned.
 *
 * @example
 * generateHands( deck, 4 ) // returns an array of 4 hands if the deck can be evenly divided
 *
 * @param deck Array of PlayingCard objects representing the deck
 * @param handCount Number of hands to generate
 * @returns Array of hands, each containing an equal number of cards
 */
export function generateHands( deck: CardId[], handCount: number ) {
	if ( deck.length % handCount !== 0 ) {
		return [];
	}

	const handSize = deck.length / handCount;
	return chunk( deck, handSize );
}