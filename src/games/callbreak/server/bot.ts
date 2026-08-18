import {
	CALLBREAK_MIN_DECLARATION,
	CALLBREAK_PLAYER_COUNT,
	CALLBREAK_TRICKS_PER_DEAL,
	Trick
} from "@/games/callbreak/shared/schema.ts";
import {
	getCardValue,
	getHighestCardValue,
	getPlayableCards
} from "@/games/callbreak/shared/utils.ts";
import { CARD_SUITS, getCardRank, getCardSuit } from "@/shared/cards/utils.ts";

import type { CallbreakConfig, CallbreakView } from "@/games/callbreak/shared/schema.ts";
import type { CardId, CardSuit } from "@/shared/cards/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";

const SUITS: ReadonlyArray<CardSuit> = Object.values( CARD_SUITS );

/**
 * Sort cards by their rank value in ascending order.
 * @param cards - The cards to sort.
 * @returns A new sorted array of cards.
 */
function sortByValue( cards: ReadonlyArray<CardId> ) {
	return cards.toSorted( ( a, b ) => getCardValue( a ) - getCardValue( b ) );
}

/**
 * Return the lowest-valued card from a set.
 * @param cards - The cards to choose from, never empty.
 * @returns The card with the lowest rank value.
 */
function lowest( cards: ReadonlyArray<CardId> ) {
	return sortByValue( cards )[ 0 ]!;
}

/**
 * Return the highest-valued card from a set.
 * @param cards - The cards to choose from, never empty.
 * @returns The card with the highest rank value.
 */
function highest( cards: ReadonlyArray<CardId> ) {
	const sorted = sortByValue( cards );
	return sorted[ sorted.length - 1 ]!;
}

/**
 * Return the lowest card that beats a given threshold value.
 * @param cards - The cards to choose from.
 * @param threshold - The value that must be exceeded.
 * @returns The lowest winning card, or `undefined` if none can beat the threshold.
 */
function lowestWinning( cards: ReadonlyArray<CardId>, threshold: number ) {
	return sortByValue( cards ).find( card => getCardValue( card ) > threshold );
}

/**
 * Filter cards by suit.
 * @param hand - The cards to filter.
 * @param suit - The suit to match.
 * @returns Cards matching the specified suit.
 */
function getSuitCards( hand: ReadonlyArray<CardId>, suit: CardSuit ) {
	return hand.filter( card => getCardSuit( card ) === suit );
}

/**
 * The trick the seat is about to play into. A settled trick is still the newest
 * one until its winner leads again — the engine opens the next one in
 * `beforeMove`, which has not run yet when the policy is asked — so a trick
 * that already has a winner is read as the empty trick this seat is opening.
 *
 * Without this the policy would pick its lead by following the suit of a trick
 * that is already over.
 *
 * @param trick - The newest trick on the deal, if there is one.
 * @param playerId - The seat about to act.
 * @returns The trick to reason against.
 */
function trickInPlay( trick: Trick | undefined, playerId: PlayerId ) {
	const settled = !trick
		|| !!trick.winner
		|| Object.keys( trick.cards ).length >= CALLBREAK_PLAYER_COUNT;

	return settled ? Trick.make( { leadPlayer: playerId, cards: {} } ) : trick;
}

/**
 * Bot AI for declaring the number of tricks expected to win.
 * Evaluates hand strength based on high trump cards, non-trump aces/kings, and void suits.
 *
 * @param view - The seat's own view of the game.
 * @param config - The game configuration including trump suit.
 * @returns The number of tricks the bot declares it will win, within the legal range.
 */
export function botDeclare( view: CallbreakView, config: CallbreakConfig ) {
	let score = 0;

	const hand = view.hand;
	const trumpCards = getSuitCards( hand, config.trumpSuit );
	const suits = SUITS.filter( suit => suit !== config.trumpSuit );

	// High trumps are near-guaranteed wins
	for ( const card of trumpCards ) {
		const rank = getCardRank( card );
		score += rank === "A" || rank === "K" || rank === "Q" ? 1 : 0.5;
	}

	for ( const suit of suits ) {
		const suitCards = getSuitCards( hand, suit );
		if ( suitCards.length === 0 ) {
			// Void suit with trumps means we can trump in
			if ( trumpCards.length > 0 ) {
				score += 0.5;
			}
			continue;
		}

		for ( const card of suitCards ) {
			const rank = getCardRank( card );
			if ( rank === "A" ) {
				score += 0.75;
			} else if ( rank === "K" && suitCards.length >= 2 ) {
				score += 0.5;
			}
		}
	}

	// The declaration is decoded at the move boundary, so a policy that fell
	// outside the legal range would be an illegal move the engine dies on.
	return Math.min(
		CALLBREAK_TRICKS_PER_DEAL,
		Math.max( CALLBREAK_MIN_DECLARATION, Math.floor( score ) )
	);
}

/**
 * Bot AI for selecting which card to play in the current trick.
 * Considers whether leading or following, trump management, and remaining win targets.
 *
 * @param view - The seat's own view of the game.
 * @param config - The game configuration including trump suit.
 * @param playerId - The seat the policy is playing for.
 * @returns The card ID the bot chooses to play.
 */
export function botPlayCard(
	view: CallbreakView,
	config: CallbreakConfig,
	playerId: PlayerId
) {
	const activeDeal = view.activeDeal!;
	const activeTrick = trickInPlay( activeDeal.tricks[ 0 ], playerId );
	const playable = getPlayableCards( view.hand, config.trumpSuit, activeTrick );

	if ( playable.length === 1 ) {
		return playable[ 0 ]!;
	}

	const { declarations, wins } = activeDeal;
	const needsMore = ( declarations[ playerId ] ?? 0 ) - ( wins[ playerId ] ?? 0 ) > 0;
	const isLeading = Object.keys( activeTrick.cards ).length === 0;

	return isLeading
		? leadCard( playable, config.trumpSuit, needsMore )
		: followCard( playable, config.trumpSuit, activeTrick, needsMore );
}

/**
 * Select which card the bot should lead with when starting a trick.
 *
 * @param playable - The playable cards in hand, never empty.
 * @param trumpSuit - The trump suit for this game.
 * @param needsMore - Whether the bot still needs more wins to meet its declaration.
 * @returns The card ID to lead with.
 */
function leadCard( playable: ReadonlyArray<CardId>, trumpSuit: CardSuit, needsMore: boolean ) {
	if ( !needsMore ) {
		return lowest( playable );
	}

	// Lead with a plain-suit winner first — the trumps are worth more held back.
	const nonTrump = playable.filter( card => getCardSuit( card ) !== trumpSuit );
	if ( nonTrump.length > 0 ) {
		const best = highest( nonTrump );
		const rank = getCardRank( best );
		if ( rank === "A" || rank === "K" ) {
			return best;
		}
	}

	const trumpCards = playable.filter( card => getCardSuit( card ) === trumpSuit );
	return trumpCards.length > 0 ? highest( trumpCards ) : highest( playable );
}

/**
 * Select which card the bot should play when following in a trick.
 * Handles following suit, trumping, and discarding when void.
 *
 * @param playable - The playable cards in hand, never empty.
 * @param trumpSuit - The trump suit for this game.
 * @param trick - The current trick in progress.
 * @param needsMore - Whether the bot still needs more wins to meet its declaration.
 * @returns The card ID to play.
 */
function followCard(
	playable: ReadonlyArray<CardId>,
	trumpSuit: CardSuit,
	trick: Trick,
	needsMore: boolean
) {
	const trickCards = Object.values( trick.cards );
	const leadSuit = trick.suit ?? getCardSuit( trickCards[ 0 ]! );
	const suitCards = playable.filter( card => getCardSuit( card ) === leadSuit );
	const trumpCards = playable.filter( card => getCardSuit( card ) === trumpSuit );
	const trumpPlayed = trickCards.some( card => getCardSuit( card ) === trumpSuit );

	// Following suit
	if ( suitCards.length > 0 ) {
		// A trump on a plain-suit trick has already taken it — nothing in suit can
		// win it back, so the cheapest legal card goes.
		if ( !needsMore || ( trumpPlayed && leadSuit !== trumpSuit ) ) {
			return lowest( suitCards );
		}

		const highestPlayed = getHighestCardValue( trickCards, leadSuit );
		return lowestWinning( suitCards, highestPlayed ) ?? lowest( suitCards );
	}

	// Void in the led suit but holding trump
	if ( trumpCards.length > 0 ) {
		if ( !needsMore || !trumpPlayed ) {
			return lowest( trumpCards );
		}

		const highestTrump = getHighestCardValue( trickCards, trumpSuit );
		return lowestWinning( trumpCards, highestTrump ) ?? lowest( trumpCards );
	}

	// No suit, no trump — dump the lowest of the longest suit held.
	const bySuit = new Map<CardSuit, Array<CardId>>();
	for ( const card of playable ) {
		const suit = getCardSuit( card );
		bySuit.set( suit, [ ...bySuit.get( suit ) ?? [], card ] );
	}

	const longest = [ ...bySuit.values() ].reduce(
		( best, cards ) => cards.length > best.length ? cards : best,
		[] as ReadonlyArray<CardId>
	);

	return lowest( longest.length > 0 ? longest : playable );
}
