import type { CallbreakConfig, CallbreakPlayerView, Trick } from "@/callbreak/core/types";
import { getCardValue, getPlayableCards } from "@/callbreak/core/utils";
import { type CardId, type CardSuit, getCardRank, getCardSuit } from "@/shared/utils/cards";

function sortByValue( cards: CardId[] ): CardId[] {
	return [ ...cards ].sort( ( a, b ) => getCardValue( a ) - getCardValue( b ) );
}

function lowest( cards: CardId[] ): CardId {
	return sortByValue( cards )[ 0 ];
}

function highest( cards: CardId[] ): CardId {
	return sortByValue( cards )[ cards.length - 1 ];
}

function lowestWinning( cards: CardId[], threshold: number ) {
	const winners = sortByValue( cards ).filter( c => getCardValue( c ) > threshold );
	return winners.length > 0 ? winners[ 0 ] : undefined;
}

function getHighestPlayedValue( trickCards: CardId[], suit: string ) {
	return trickCards
		.filter( c => getCardSuit( c ) === suit )
		.reduce( ( max, c ) => Math.max( max, getCardValue( c ) ), -1 );
}

function getSuitCards( hand: CardId[], suit: string ) {
	return hand.filter( c => getCardSuit( c ) === suit );
}

export function botDeclare( state: CallbreakPlayerView, config: CallbreakConfig ) {
	let score = 0;

	const trumpCards = getSuitCards( state.hand, config.trumpSuit );
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
		const suitCards = getSuitCards( state.hand, suit );
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

export function botPlayCard( state: CallbreakPlayerView, config: CallbreakConfig ) {
	const activeDeal = state.activeDeal!;
	const activeTrick = activeDeal.tricks[ 0 ];
	const playable = getPlayableCards( state.hand, config.trumpSuit, activeTrick );

	if ( playable.length === 1 ) {
		return playable[ 0 ];
	}

	const needsMore = activeDeal.declarations[ state.playerId ] - activeDeal.wins[ state.playerId ] > 0;
	const trickCards = Object.values( activeTrick.cards );
	const isLeading = trickCards.length === 0;

	if ( isLeading ) {
		return leadCard( playable, config.trumpSuit, needsMore );
	}

	return followCard( playable, config.trumpSuit, activeTrick, needsMore );
}

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
