import {
	CARD_RANKS,
	CARD_SUITS,
	type CardId,
	type CardRank,
	type CardSuit,
	getCardRank,
	getCardSuit,
	SORTED_DECK
} from "@s2h/utils/cards";
import type { Round, StartedRound } from "./types.ts";

/**
 * Compare two cards of the same suit to determine if card1 outranks card2.
 *
 * Rules:
 * - Cards of different suits are considered non-comparable and function returns false.
 * - Ace is treated as the highest rank.
 * - Otherwise uses CARD_RANKS ordering to determine higher card.
 *
 * @param card1 CardId to test as potentially greater.
 * @param card2 CardId to compare against.
 * @returns true if card1 outranks card2 according to game ranking rules, false otherwise.
 */
export function compareCards( card1: CardId, card2: CardId ) {
	if ( getCardSuit( card1 ) !== getCardSuit( card2 ) ) {
		return false;
	}

	if ( getCardRank( card2 ) === CARD_RANKS.ACE ) {
		return false;
	}

	if ( getCardRank( card1 ) === CARD_RANKS.ACE ) {
		return true;
	}

	const ranks = Object.values( CARD_RANKS );
	return ranks.indexOf( getCardRank( card1 ) ) > ranks.indexOf( getCardRank( card2 ) );
}

/**
 * Determine the best (winning) card among those played in a started round.
 *
 * Selection priority:
 * 1. Any trump-suit cards -> highest trump wins.
 * 2. If no trump, highest card of the round suit wins.
 * 3. Otherwise, highest card among remaining cards wins.
 *
 * Does not mutate inputs.
 *
 * @param trumpSuit CardSuit considered trump for this deal.
 * @param round StartedRound containing played cards and round suit.
 * @returns CardId of the best card played in the round.
 * @public
 */
export function getBestCardPlayed( trumpSuit: CardSuit, round: StartedRound ) {
	const cardsPlayed = Object.values( round.cards );
	const trumpCards = cardsPlayed.filter( card => getCardSuit( card ) === trumpSuit );
	const roundSuitCards = cardsPlayed.filter( card => getCardSuit( card ) === round.suit );

	if ( trumpCards.length > 0 ) {
		return trumpCards.reduce( ( bestCard, card ) => compareCards( card, bestCard ) ? card : bestCard );
	}

	return roundSuitCards.reduce( ( bestCard, card ) => compareCards( card, bestCard ) ? card : bestCard );
}

/**
 * Compute the set of cards from a player's hand that are legal to play given the active round.
 *
 * Behavior:
 * - If the round has no leading suit (first play), any card in hand is playable.
 * - If the round has a suit, the function enforces playing a bigger card of that suit if possible.
 * - If no bigger card of the round suit is available, players must follow suit if possible.
 * - If unable to follow suit, players must play a trump card if possible.
 * - If no trump cards are available, any card from hand may be played.
 *
 * @param hand Array of CardId representing the player's current hand.
 * @param trumpSuit CardSuit designated as trump for the deal.
 * @param round Round object describing current round state (may be not-started).
 * @returns Array of CardId from hand that are legal to play this turn.
 * @public
 */
export function getPlayableCards( hand: CardId[], trumpSuit: CardSuit, round: Round ) {
	if ( !round.suit ) {
		return hand;
	}

	const trumpCards = hand.filter( card => getCardSuit( card ) === trumpSuit );
	const roundSuitCards = hand.filter( card => getCardSuit( card ) === round.suit );
	const greatest = getBestCardPlayed( trumpSuit, round as StartedRound );

	if ( round.suit === trumpSuit ) {
		if ( roundSuitCards.length === 0 ) {
			return hand;
		}

		const greaterCards = roundSuitCards.filter( card => compareCards( card, greatest ) );
		return greaterCards.length > 0 ? greaterCards : roundSuitCards;
	}

	if ( roundSuitCards.length === 0 ) {

		if ( getCardSuit( greatest ) !== trumpSuit ) {
			return trumpCards.length > 0 ? trumpCards : hand;
		}

		const greaterTrumpCards = trumpCards.filter( card => compareCards( card, greatest ) );
		return greaterTrumpCards.length > 0 ? greaterTrumpCards : hand;
	}

	if ( getCardSuit( greatest ) !== trumpSuit ) {
		const greaterCards = roundSuitCards.filter( card => compareCards( card, greatest ) );
		return greaterCards.length > 0 ? greaterCards : roundSuitCards;
	}

	return roundSuitCards;
}

/**
 * Heuristic to suggest how many tricks (wins) a player might reasonably declare for a deal.
 *
 * Uses:
 * - Counts high ranks (Ace, King, Queen) per suit and gives extra weight to trumps.
 * - Applies simple heuristics based on suit length to estimate potential wins.
 *
 * @param hand Array of CardId representing player's hand for the deal.
 * @param trumpSuit CardSuit currently designated as trump.
 * @returns Suggested integer number of wins the player could declare (minimum of 2).
 * @public
 */
export function suggestDealWins( hand: CardId[], trumpSuit: CardSuit ) {
	let possibleWins = 0;
	const BIG_RANKS = [ CARD_RANKS.ACE, CARD_RANKS.KING, CARD_RANKS.QUEEN ] as CardRank[];

	for ( const suit of Object.values( CARD_SUITS ) ) {
		const cards = hand.filter( card => getCardSuit( card ) === suit );
		const bigRanks = cards.filter( card => BIG_RANKS.includes( getCardRank( card ) ) );

		if ( suit === trumpSuit ) {
			possibleWins += bigRanks.length;
			continue;
		}

		if ( cards.length >= 4 ) {
			possibleWins += Math.min( bigRanks.length, 1 );
		} else if ( cards.length === 3 ) {
			possibleWins += Math.min( bigRanks.length, 2 );
		} else if ( cards.length === 2 ) {
			possibleWins += 1 + bigRanks.length;
		} else {
			possibleWins += 2 + bigRanks.length;
		}
	}

	if ( possibleWins < 2 ) {
		possibleWins = 2;
	}

	return possibleWins;
}

/**
 * Suggest a card for the current player to play.
 *
 * Strategy:
 * - Compute playable cards for the active round.
 * - Identify "unbeatable" cards by checking whether any higher card remains in the deck
 *   that is not already out of play or not in the player's hand.
 * - If any unbeatable cards exist, prefer the smallest such card; otherwise select randomly
 *   from playable cards.
 *
 * @param hand Array of CardId representing player's hand.
 * @param trumpSuit CardSuit designated as trump.
 * @param cardsOffTheGame Array of CardId that have been played / removed from contention.
 * @param activeRound Current Round (may include suit and played cards).
 * @returns CardId chosen to play.
 * @public
 */
export function suggestCardToPlay(
	hand: CardId[],
	trumpSuit: CardSuit,
	cardsOffTheGame: CardId[],
	activeRound: Round
) {
	const playableCards = getPlayableCards( hand, trumpSuit, activeRound );

	const unbeatableCards = playableCards.filter( card => {
		const higherCards = SORTED_DECK.filter( deckCard => compareCards( deckCard, card ) );
		return higherCards.every( c => cardsOffTheGame.includes( c ) || hand.includes( c ) );
	} );

	return unbeatableCards.length > 0
		? unbeatableCards[ unbeatableCards.length - 1 ]
		: playableCards[ Math.floor( Math.random() * playableCards.length ) ];
}