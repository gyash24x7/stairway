import type { CallbreakConfig, CallbreakPlayerView, Trick } from "@/games/callbreak/shared/schema.ts";
import { getCardValue, getPlayableCards } from "@/games/callbreak/shared/utils.ts";
import type { CardId, CardSuit } from "@/shared/cards/schema.ts";
import { getCardRank, getCardSuit } from "@/shared/cards/utils.ts";

/**
 * Sort cards by their rank value in ascending order.
 *
 * @param cards - The cards to sort.
 * @returns A new sorted array of cards.
 */
function sortByValue( cards: CardId[] ) {
	return [ ...cards ].sort( ( a, b ) => getCardValue( a ) - getCardValue( b ) );
}

/**
 * Return the lowest-valued card from a set.
 *
 * @param cards - The cards to choose from.
 * @returns The card with the lowest rank value.
 */
function lowest( cards: CardId[] ) {
	return sortByValue( cards )[ 0 ];
}

/**
 * Return the highest-valued card from a set.
 *
 * @param cards - The cards to choose from.
 * @returns The card with the highest rank value.
 */
function highest( cards: CardId[] ) {
	return sortByValue( cards )[ cards.length - 1 ];
}

/**
 * Return the lowest card that beats a given threshold value.
 *
 * @param cards - The cards to choose from.
 * @param threshold - The value that must be exceeded.
 * @returns The lowest winning card, or undefined if none can beat the threshold.
 */
function lowestWinning( cards: CardId[], threshold: number ) {
	const winners = sortByValue( cards ).filter( c => getCardValue( c ) > threshold );
	return winners.length > 0 ? winners[ 0 ] : undefined;
}

/**
 * Get the highest card value of a specific suit among played trick cards.
 *
 * @param trickCards - The cards played in the current trick.
 * @param suit - The suit to filter by.
 * @returns The highest rank value, or -1 if no cards of that suit exist.
 */
function getHighestPlayedValue( trickCards: CardId[], suit: string ) {
	return trickCards
		.filter( c => getCardSuit( c ) === suit )
		.reduce( ( max, c ) => Math.max( max, getCardValue( c ) ), -1 );
}

/**
 * Filter cards by suit.
 *
 * @param hand - The cards to filter.
 * @param suit - The suit to match.
 * @returns Cards matching the specified suit.
 */
function getSuitCards( hand: CardId[], suit: string ) {
	return hand.filter( c => getCardSuit( c ) === suit );
}

/**
 * Bot AI for declaring the number of tricks expected to win.
 * Evaluates hand strength based on high trump cards, non-trump aces/kings, and void suits.
 *
 * @param state - The bot's player view of the game state.
 * @param config - The game configuration including trump suit.
 * @returns The number of tricks the bot declares it will win (minimum 1).
 */
export function botDeclare( state: CallbreakPlayerView, config: CallbreakConfig ) {
	let score = 0;

	const hand = [ ...state.hand ];
	const trumpCards = getSuitCards( hand, config.trumpSuit );
	const suits = [ "C", "S", "H", "D" ].filter( s => s !== config.trumpSuit );

	// High trumps are near-guaranteed wins
	for ( const card of trumpCards ) {
		const rank = getCardRank( card );
		if ( rank === "A" || rank === "K" || rank === "Q" ) {
			score += 1;
		} else {
			score += 0.5;
		}
	}

	// Non-trump aces
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

	return Math.max( 1, Math.floor( score ) );
}

/**
 * Bot AI for selecting which card to play in the current trick.
 * Considers whether leading or following, trump management, and remaining win targets.
 *
 * @param state - The bot's player view of the game state.
 * @param config - The game configuration including trump suit.
 * @returns The card ID the bot chooses to play.
 */
export function botPlayCard( state: CallbreakPlayerView, config: CallbreakConfig ) {
	const activeDeal = state.activeDeal!;
	const activeTrick = activeDeal.tricks[ 0 ]!;
	const playable = getPlayableCards( [ ...state.hand ], config.trumpSuit, activeTrick );

	if ( playable.length === 1 ) {
		return playable[ 0 ];
	}

	const { declarations, wins } = activeDeal;
	const needsMore = declarations[ state.playerId ] - wins[ state.playerId ] > 0;
	const trickCards = Object.values( activeTrick.cards );
	const isLeading = trickCards.length === 0;

	if ( isLeading ) {
		return leadCard( playable, config.trumpSuit, needsMore );
	}

	return followCard( playable, config.trumpSuit, activeTrick, needsMore );
}

/**
 * Select which card the bot should lead with when starting a trick.
 *
 * @param playable - The playable cards in hand.
 * @param trumpSuit - The trump suit for this game.
 * @param needsMore - Whether the bot still needs more wins to meet its declaration.
 * @returns The card ID to lead with.
 */
function leadCard( playable: CardId[], trumpSuit: CardSuit, needsMore: boolean ) {
	if ( !needsMore ) {
		return lowest( playable );
	}

	// Lead with highest non-trump winner first
	const nonTrump = playable.filter( c => getCardSuit( c ) !== trumpSuit );
	if ( nonTrump.length > 0 ) {
		const highNonTrump = sortByValue( nonTrump );
		const best = highNonTrump[ highNonTrump.length - 1 ];
		const rank = getCardRank( best );
		if ( rank === "A" || rank === "K" ) {
			return best;
		}
	}

	// No non-trump winners — lead with highest trump
	const trumpCards = playable.filter( c => getCardSuit( c ) === trumpSuit );
	if ( trumpCards.length > 0 ) {
		return highest( trumpCards );
	}

	// No trumps either — lead highest card
	return highest( playable );
}

/**
 * Select which card the bot should play when following in a trick.
 * Handles following suit, trumping, and discarding when void.
 *
 * @param playable - The playable cards in hand.
 * @param trumpSuit - The trump suit for this game.
 * @param trick - The current trick in progress.
 * @param needsMore - Whether the bot still needs more wins to meet its declaration.
 * @returns The card ID to play.
 */
function followCard( playable: CardId[], trumpSuit: CardSuit, trick: Trick, needsMore: boolean ) {
	const trickCards = Object.values( trick.cards );
	const leadSuit = trick.suit!;
	const suitCards = playable.filter( c => getCardSuit( c ) === leadSuit );
	const trumpCards = playable.filter( c => getCardSuit( c ) === trumpSuit );
	const trumpPlayed = trickCards.some( c => getCardSuit( c ) === trumpSuit );

	// Following suit
	if ( suitCards.length > 0 ) {
		if ( !needsMore ) {
			return lowest( suitCards );
		}

		// If trump was played on a non-trump suit, can't win with suit cards — dump lowest
		if ( trumpPlayed && leadSuit !== trumpSuit ) {
			return lowest( suitCards );
		}

		const highestPlayed = getHighestPlayedValue( trickCards, leadSuit );
		const winner = lowestWinning( suitCards, highestPlayed );
		return winner ?? lowest( suitCards );
	}

	// Must trump
	if ( trumpCards.length > 0 ) {
		if ( !needsMore ) {
			return lowest( trumpCards );
		}

		if ( trumpPlayed ) {
			const highestTrump = getHighestPlayedValue( trickCards, trumpSuit );
			const winner = lowestWinning( trumpCards, highestTrump );
			return winner ?? lowest( trumpCards );
		}

		// No trump played yet — lowest trump wins
		return lowest( trumpCards );
	}

	// No suit, no trump — dump lowest from longest non-trump suit
	const suits = new Map<string, CardId[]>();
	for ( const card of playable ) {
		const suit = getCardSuit( card );
		if ( !suits.has( suit ) ) {
			suits.set( suit, [] );
		}
		suits.get( suit )!.push( card );
	}

	let longestSuit: CardId[] = playable;
	for ( const cards of suits.values() ) {
		if ( cards.length > longestSuit.length || longestSuit === playable ) {
			longestSuit = cards;
		}
	}

	return lowest( longestSuit );
}
