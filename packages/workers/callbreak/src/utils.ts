import type { CardId, CardSuit, PlayingCard } from "@s2h/cards/types";
import { compareCards, getCardId, getCardsOfSuit, isCardInHand } from "@s2h/cards/utils";

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
 * @param {PlayingCard | CardId} card Card object or card identifier to check for
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
	if ( typeof card !== "string" ) {
		card = getCardId( card );
	}

	const greatest = getBestCardPlayed( cardsAlreadyPlayed, trumpSuit, roundSuit );
	if ( !greatest || !roundSuit ) {
		return isCardInHand( hand, card );
	}

	const playableCards = getPlayableCards( hand, trumpSuit, greatest, roundSuit );
	return isCardInHand( playableCards, card );
}