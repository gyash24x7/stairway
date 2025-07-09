import { CARD_RANKS, CARD_SETS, SORTED_DECK, UPPER_CARD_RANKS } from "@/libs/cards/constants";
import type { CardDisplay, CardId, CardRank, CardSet, CardSuit, PlayingCard } from "@/libs/cards/types";
import { chunk, shuffle } from "@/shared/utils/array";

// Utility functions for card operations

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
 * The display string is formatted as "Rank of Suit".
 *
 * @example
 * getCardDisplayString({ rank: "A", suit: "H" }) // returns "Ace of Hearts"
 * getCardDisplayString("AH") // returns "Ace of Hearts"
 *
 * @param {PlayingCard | CardId} card Either a PlayingCard object or a string identifier of the card.
 * @returns {CardDisplay} Display string for the card
 */
export function getCardDisplayString( card: PlayingCard | CardId ): CardDisplay {
	if ( typeof card === "string" ) {
		card = getCardFromId( card );
	}
	return card.rank.concat( " of " ).concat( card.suit ) as CardDisplay;
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
 * Returns the set of a playing card based on its suit and rank.
 * The set is determined by whether the card's rank is in the upper or lower half of the ranks.
 *
 * @example
 * getCardSet({ rank: "A", suit: "H" }) // returns "UH" (Upper Hearts)
 * getCardSet("AH") // returns "UH" (Upper Hearts)
 *
 * @param {PlayingCard | string} card Either a PlayingCard object or a string identifier of the card.
 * @returns {CardSet} The set of the card, which can be one of the predefined card sets.
 */
export function getCardSet( card: PlayingCard | CardId ): CardSet {
	let temp = typeof card === "string" ? getCardFromId( card ) : card;
	switch ( temp.suit ) {
		case "H":
			return UPPER_CARD_RANKS.includes( temp.rank ) ? CARD_SETS.UPPER_HEARTS : CARD_SETS.LOWER_HEARTS;
		case "C":
			return UPPER_CARD_RANKS.includes( temp.rank ) ? CARD_SETS.UPPER_CLUBS : CARD_SETS.LOWER_CLUBS;
		case "D":
			return UPPER_CARD_RANKS.includes( temp.rank ) ? CARD_SETS.UPPER_DIAMONDS : CARD_SETS.LOWER_DIAMONDS;
		case "S":
			return UPPER_CARD_RANKS.includes( temp.rank ) ? CARD_SETS.UPPER_SPADES : CARD_SETS.LOWER_SPADES;
	}
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
export function getCardsOfSuit( suit: CardSuit, hand?: PlayingCard[] ): PlayingCard[] {
	return ( hand ?? SORTED_DECK ).filter( card => card.suit === suit );
}

/**
 * Returns all cards of a specific set from a hand or the entire sorted deck.
 * If no hand is provided, it defaults to using the sorted deck.
 *
 * @example
 * getCardsOfSet(CardSet.UPPER_HEARTS) // returns all Upper Hearts cards from the sorted deck
 * getCardsOfSet(CardSet.LOWER_CLUBS, hand) // returns all Lower Clubs cards from the provided hand
 *
 * @param {CardSet} set Card set to filter by
 * @param {PlayingCard[]} hand Optional hand of cards to filter from
 * @returns {PlayingCard[]} Cards of the specified set
 */
export function getCardsOfSet( set: CardSet, hand?: PlayingCard[] ): PlayingCard[] {
	return ( hand ?? SORTED_DECK ).filter( card => getCardSet( card ) === set );
}

/**
 * Returns a set of all unique card sets present in a hand.
 * @example
 * getSetsInHand( hand ) // returns a Set of card sets like {"LC", "UC", "LS", "US", "LD", "UD", "LH", "UH"}
 *
 * @param {PlayingCard[]} hand Array of PlayingCard objects representing the hand
 * @returns {Set<CardSet>} Set of unique card sets present in the hand
 */
export function getSetsInHand( hand: PlayingCard[] ): Set<CardSet> {
	return new Set( hand.map( getCardSet ) );
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
 * Checks if a specific card set is present in a hand.
 * @example
 * isCardSetInHand( hand, CardSet.UPPER_HEARTS ) // returns true if Upper Hearts is in the hand
 *
 * @param {PlayingCard[]} hand Array of PlayingCard objects representing the hand
 * @param {CardSet} set Card set to check for
 * @returns {boolean} True if the card set is present in the hand, false otherwise
 */
export function isCardSetInHand( hand: PlayingCard[], set: CardSet ): boolean {
	return getSetsInHand( hand ).has( set );
}

/**
 * Returns all cards of a specific set that are not present in the hand.
 * This is useful for determining which cards can be asked for in a game.
 *
 * @example
 * getAskableCardsOfSet( hand, CardSet.UPPER_HEARTS ) // returns all Upper Hearts cards not in the hand
 *
 * @param {PlayingCard[]} hand Array of PlayingCard objects representing the hand
 * @param {CardSet} set Card set to filter by
 * @returns {PlayingCard[]} Cards of the specified set that are not in the hand
 */
export function getAskableCardsOfSet( hand: PlayingCard[], set: CardSet ): PlayingCard[] {
	return getCardsOfSet( set ).filter( card => !hand.map( getCardId ).includes( getCardId( card ) ) );
}

/**
 * Checks if a specific card is present in a hand.
 * @example
 * isCardInHand( hand, { rank: "A", suit: "H" } ) // returns true if Ace of Hearts is in the hand
 *
 * @param {PlayingCard[]} hand Array of PlayingCard objects representing the hand
 * @param {PlayingCard | CardId} card Card object or string identifier to check for
 * @returns {boolean} True if the card is present in the hand, false otherwise
 */
export function isCardInHand( hand: PlayingCard[], card: PlayingCard | CardId ): boolean {
	if ( typeof card === "string" ) {
		return hand.map( getCardId ).includes( card );
	}
	return hand.map( getCardId ).includes( getCardId( card ) );
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
	return SORTED_DECK.filter( card => hand.map( getCardId ).includes( getCardId( card ) ) );
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

/**
 * Removes cards from a hand based on a provided function.
 * If no hand is provided, it defaults to using the sorted deck.
 *
 * @param {(card: PlayingCard) => boolean} fn Function to determine which cards to remove
 * @param {PlayingCard[]} hand Optional hand of cards to filter from
 * @returns {PlayingCard[]} Array of PlayingCard objects that do not match the criteria defined by the function
 */
export function removeCards( fn: ( card: PlayingCard ) => boolean, hand?: PlayingCard[] ): PlayingCard[] {
	return ( hand ?? SORTED_DECK ).filter( card => !fn( card ) );
}

/**
 * Returns the best card played in a round based on the trump suit and the round suit.
 * The best card is determined by the highest rank of cards played in the round suit or trump suit.
 *
 * @example
 * getBestCardPlayed(cardsPlayed, "H", "C") // returns the best card played in when
 * the trump suit is Hearts and the round suit is Clubs
 *
 * @param {PlayingCard[]} cardsPlayed Array of cards played in the round
 * @param {string} trumpSuit The suit that is considered trump for this round
 * @param {string | null} roundSuit The suit that was led in this round, or null if no suit was led
 * @returns {PlayingCard | undefined} The best card played, or undefined if no cards were played yet
 */
export function getBestCardPlayed(
	cardsPlayed: PlayingCard[],
	trumpSuit: CardSuit,
	roundSuit?: CardSuit
): PlayingCard | undefined {
	if ( cardsPlayed.length === 0 || !roundSuit ) {
		return undefined;
	}

	const trumpCards = cardsPlayed.filter( card => card.suit === trumpSuit );
	const roundSuitCards = cardsPlayed.filter( card => card.suit === roundSuit );
	const otherCards = cardsPlayed.filter( card => card.suit !== trumpSuit && card.suit !== roundSuit );

	if ( trumpCards.length > 0 ) {
		return trumpCards.reduce( ( bestCard, card ) => compareCards( card, bestCard ) ? card : bestCard );
	}

	if ( roundSuitCards.length > 0 ) {
		return roundSuitCards.reduce( ( bestCard, card ) => compareCards( card, bestCard ) ? card : bestCard );
	}

	return otherCards.reduce( ( bestCard, card ) => compareCards( card, bestCard ) ? card : bestCard );
}

/**
 * Returns the cards that can be played from a hand based on the current round's suit and the trump suit.
 * If the round suit is the same as the trump suit, it returns cards of that suit that are greater
 * than the greatest card played.
 * If the round suit is different from the trump suit, it returns cards of the round suit that are
 * greater than the greatest card played.
 * If no cards of the round suit are available, it returns cards of the trump suit that are
 * greater than the greatest card played.
 * If no cards of the trump suit are available, it returns all cards in hand.
 *
 * @example
 * getPlayableCards(hand, "H", greatestCard, "C") // returns playable cards from hand
 *
 * @param {PlayingCard[]} hand Array of PlayingCard objects representing the player's hand
 * @param {CardSuit} trumpSuit The suit that is considered trump for this round
 * @param {PlayingCard} greatest The greatest card played in the current round
 * @param {CardSuit} roundSuit The suit that was led in this round, or undefined if no suit was led
 * @returns {PlayingCard[]} Array of playable cards from the hand based on the current round's suit and trump suit
 */
export function getPlayableCards(
	hand: PlayingCard[],
	trumpSuit: CardSuit,
	greatest?: PlayingCard,
	roundSuit?: CardSuit
): PlayingCard[] {
	if ( !greatest || !roundSuit ) {
		return hand;
	}

	const cardsOfRoundSuit = getCardsOfSuit( roundSuit, hand );
	const trumpCards = getCardsOfSuit( trumpSuit, hand );

	if ( roundSuit === trumpSuit ) {
		if ( cardsOfRoundSuit.length === 0 ) {
			return hand;
		}

		const greaterCards = cardsOfRoundSuit.filter( card => compareCards( card, greatest ) );
		return greaterCards.length > 0 ? greaterCards : cardsOfRoundSuit;
	}

	if ( cardsOfRoundSuit.length === 0 ) {

		if ( greatest.suit !== trumpSuit ) {
			return trumpCards.length > 0 ? trumpCards : hand;
		}

		const greaterTrumpCards = trumpCards.filter( card => compareCards( card, greatest ) );
		return greaterTrumpCards.length > 0 ? greaterTrumpCards : hand;
	}

	if ( greatest.suit !== trumpSuit ) {
		const greaterCards = cardsOfRoundSuit.filter( card => compareCards( card, greatest ) );
		return greaterCards.length > 0 ? greaterCards : cardsOfRoundSuit;
	}

	return cardsOfRoundSuit;
}

/**
 * Checks if a specific card can be played from a hand based on the current round's suit and the trump suit.
 * It first checks if the card is in the hand, then checks if it is among the playable cards based on the
 * greatest card played and the round suit.
 *
 * @example
 * canCardBePlayed({ rank: "A", suit: "H" }, hand, "H", greatestCard, "C") // returns true if the card can be played
 *
 * @param {PlayingCard | string} card Card object or string identifier to check for
 * @param {PlayingCard[]} hand Array of PlayingCard objects representing the player's hand
 * @param {CardSuit} trumpSuit The suit that is considered trump for this round
 * @param {PlayingCard[]} cardsAlreadyPlayed Array of PlayingCard objects that have already been played in the current round
 * @param {CardSuit} roundSuit The suit that was led in this round, or undefined if no suit was led
 * @returns {boolean} True if the card can be played, false otherwise
 */
export function canCardBePlayed(
	card: PlayingCard | CardId,
	hand: PlayingCard[],
	trumpSuit: CardSuit,
	cardsAlreadyPlayed: PlayingCard[],
	roundSuit?: CardSuit
): boolean {
	const greatest = getBestCardPlayed( cardsAlreadyPlayed, trumpSuit, roundSuit );
	if ( !greatest || !roundSuit ) {
		return isCardInHand( hand, card );
	}

	const playableCards = getPlayableCards( hand, trumpSuit, greatest, roundSuit );
	return isCardInHand( playableCards, card );
}