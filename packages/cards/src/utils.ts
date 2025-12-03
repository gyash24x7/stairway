import { chunk, shuffle } from "@s2h/utils/array";
import { CARD_RANKS, CARD_SUITS, SORTED_DECK } from "./constants.ts";
import type { CardDisplay, CardId, CardRank, CardSuit, PlayingCard } from "./types.ts";

/**
 * Generates a unique identifier for a playing card.
 * This identifier is a combination of the card's rank and suit.
 *
 * @example
 * getCardId({ rank: "A", suit: "H" }) // returns "AH"
 *
 * @param {PlayingCard} card Card object
 * @returns {CardId} Unique identifier for the card
 */
export function getCardId( card: PlayingCard ): CardId {
	return card.rank.concat( card.suit ) as CardId;
}

/**
 * Generates a display string for a playing card.
 * The display string is formatted as "RANK OF SUIT".
 *
 * @example
 * getCardDisplayString({ rank: "A", suit: "H" }) // returns "ACE OF HEARTS"
 * getCardDisplayString("AH") // returns "ACE OF HEARTS"
 *
 * @param {PlayingCard | CardId} card Either a PlayingCard object or a string identifier of the card.
 * @returns {CardDisplay} Display string for the card
 */
export function getCardDisplayString( card: PlayingCard | CardId ): CardDisplay {
	if ( typeof card === "string" ) {
		card = getCardFromId( card );
	}
	const rankDisplay = Object.keys( CARD_RANKS ).map( k => k as keyof typeof CARD_RANKS )
		.find( key => CARD_RANKS[ key ] === card.rank )!;

	const suitDisplay = Object.keys( CARD_SUITS ).map( k => k as keyof typeof CARD_SUITS )
		.find( key => CARD_SUITS[ key ] === card.suit )!;

	return `${ rankDisplay } OF ${ suitDisplay }`;
}

/**
 * Returns the image URL for a playing card based on its identifier or PlayingCard object.
 * If the input is a PlayingCard object, it first converts it to a CardId.
 *
 * @example
 * getCardImage({ rank: "A", suit: "H" }) // returns "https://deckofcardsapi.com/static/img/AH.png"
 * getCardImage("AH") // returns "https://deckofcardsapi.com/static/img/AH.png"
 *
 * @param {PlayingCard | CardId} card Either a PlayingCard object or a string identifier of the card.
 * @returns {string} URL of the card image
 */
export function getCardImage( card: PlayingCard | CardId ): string {
	if ( typeof card !== "string" ) {
		card = getCardId( card );
	}
	return `/cards/${ card }.svg`;
}

/**
 * Returns the suit of a playing card based on its identifier or PlayingCard object.
 * If the input is a string, it extracts the suit from the last character of the string.
 *
 * @example
 * getCardSuit({ rank: "A", suit: "H" }) // returns "H"
 * getCardSuit("AH") // returns "H"
 *
 * @param {PlayingCard | CardId} card Either a PlayingCard object or a string identifier of the card.
 * @returns {CardSuit} The suit of the card, which can be one of "H", "C", "D", or "S".
 */
export function getCardSuit( card: PlayingCard | CardId ): CardSuit {
	if ( typeof card === "string" ) {
		return card.charAt( card.length - 1 ) as CardSuit;
	}
	return card.suit;
}

/**
 * Compares two playing cards to determine which one is greater.
 * The comparison is based on the suit and rank of the cards.
 * If the suits are different, the cards are considered different.
 * If one card is an Ace, it is considered greater than the other.
 * If both cards are not Aces, the comparison is based on their ranks.
 *
 * @example
 * compareCards({ rank: "A", suit: "H" }, { rank: "K", suit: "H" }) // returns true
 * compareCards({ rank: "K", suit: "H" }, { rank: "A", suit: "H" }) // returns false
 * compareCards({ rank: "K", suit: "H" }, { rank: "Q", suit: "H" }) // returns true
 *
 * @param {PlayingCard} card1 Card to compare against
 * @param {PlayingCard} card2 Card to compare with
 * @returns {boolean} Returns true if card1 is greater than card2, false otherwise.
 */
export function compareCards( card1: PlayingCard, card2: PlayingCard ): boolean {
	if ( card1.suit !== card2.suit ) {
		return false;
	}

	if ( card2.rank === CARD_RANKS.ACE ) {
		return false;
	}

	if ( card1.rank === CARD_RANKS.ACE ) {
		return true;
	}

	const ranks = Object.values( CARD_RANKS );
	return ranks.indexOf( card1.rank ) > ranks.indexOf( card2.rank );
}

/**
 * Converts a card identifier string into a PlayingCard object.
 * The identifier is expected to be in the format "RankSuit", e.g., "AH" for Ace of Hearts.
 *
 * @example
 * getCardFromId("AH") // returns { rank: "A", suit: "H" }
 *
 * @param {CardId} id Card identifier string
 * @returns {PlayingCard} PlayingCard object with rank and suit properties
 */
export function getCardFromId( id: CardId ): PlayingCard {
	const rank = id.slice( 0, id.length - 1 ) as CardRank;
	const suit = id.charAt( id.length - 1 ) as CardSuit;
	return { rank, suit } as PlayingCard;
}


// Utility functions for hands

/**
 * Returns all cards of a specific suit from a hand or the entire sorted deck.
 * If no hand is provided, it defaults to using the sorted deck.
 *
 * @example
 * getCardsOfSuit(CardSuit.HEARTS) // returns all Hearts cards from the sorted deck
 *
 * @param {CardSuit} suit Card suit to filter by
 * @param {PlayingCard[]} hand Optional hand of cards to filter from
 * @returns {PlayingCard[]} Cards of the specified suit
 */
export function getCardsOfSuit( suit: CardSuit, hand: PlayingCard[] = SORTED_DECK ): PlayingCard[] {
	return hand.filter( card => card.suit === suit );
}

/**
 * Returns a set of all unique suits present in a hand.
 * @example
 * getSuitsInHand( hand ) // returns a Set of suits like {"C", "D", "H", "S"}
 *
 * @param {PlayingCard[]} hand Array of PlayingCard objects representing the hand
 * @returns {Set<CardSuit>} Set of unique suits present in the hand
 */
export function getSuitsInHand( hand: PlayingCard[] ): Set<CardSuit> {
	return new Set( hand.map( card => card.suit ) );
}

/**
 * Checks if a specific card suit is present in a hand.
 * @example
 * isCardSuitInHand( hand, CardSuit.Hearts ) // returns true if Hearts is in the hand
 *
 * @param {PlayingCard[]} hand Array of PlayingCard objects representing the hand
 * @param {CardSuit} suit Card suit to check for
 * @returns {boolean} True if the card suit is present in the hand, false otherwise
 */
export function isCardSuitInHand( hand: PlayingCard[], suit: CardSuit ): boolean {
	return getSuitsInHand( hand ).has( suit );
}

/**
 * Checks if a specific card is present in a hand.
 * @example
 * isCardInHand( hand, { rank: "A", suit: "H" } ) // returns true if Ace of Hearts is in the hand
 *
 * @param {PlayingCard[] | CardId[]} hand Array of PlayingCard objects representing the hand
 * @param {CardId} cardId Card id to check for
 * @returns {boolean} True if the card is present in the hand, false otherwise
 */
export function isCardInHand( hand: PlayingCard[], cardId: CardId ): boolean {
	return hand.map( getCardId ).includes( cardId );
}

/**
 * Returns a sorted version of a hand based on the predefined sorted deck.
 * This function ensures that the cards in the hand are returned in the same order as they appear in the sorted deck.
 *
 * @example
 * getSortedHand( hand ) // returns the hand sorted according to SORTED_DECK
 *
 * @param {PlayingCard[]} hand Array of PlayingCard objects representing the hand
 * @returns {PlayingCard[]} Sorted array of PlayingCard objects
 */
export function getSortedHand( hand: PlayingCard[] ): PlayingCard[] {
	return SORTED_DECK.filter( card => isCardInHand( hand, getCardId( card ) ) );
}

/**
 * Generates a shuffled deck of playing cards.
 * The deck is created from the predefined sorted deck and then shuffled.
 *
 * @example
 * generateDeck() // returns a shuffled array of PlayingCard objects
 *
 * @returns {PlayingCard[]} Shuffled array of PlayingCard objects
 */
export function generateDeck(): PlayingCard[] {
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
 * @param {PlayingCard[]} deck Array of PlayingCard objects representing the deck
 * @param {number} handCount Number of hands to generate
 * @returns {PlayingCard[][]} Array of hands, each containing an equal number of cards
 */
export function generateHands( deck: PlayingCard[], handCount: number ): PlayingCard[][] {
	if ( deck.length % handCount !== 0 ) {
		return [];
	}

	const handSize = deck.length / handCount;
	return chunk( deck, handSize );
}
