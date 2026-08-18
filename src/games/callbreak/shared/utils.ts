import { getCardRank, getCardSuit } from "@/shared/cards/utils.ts";

import type { Trick } from "@/games/callbreak/shared/schema.ts";
import type { CardId, CardRank, CardSuit } from "@/shared/cards/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";


/**
 * Trick-taking order, weakest first. Aces are high in Callbreak, which is why
 * this is not the deck's own `A`-first ordering — `getCardValue` indexes into
 * it, so the array *is* the ranking.
 */
export const RANK_ORDER: ReadonlyArray<CardRank> = [
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"J",
	"Q",
	"K",
	"A"
];

/**
 * Where a card sits in the trick-taking order.
 * @param card - The card to rank.
 * @returns Its index in {@link RANK_ORDER} — higher beats lower within a suit.
 */
export function getCardValue( card: CardId ) {
	return RANK_ORDER.indexOf( getCardRank( card ) );
}

/**
 * The highest card of one suit among a set, as a rank value.
 * @param cards - The cards to look through.
 * @param suit - The suit to measure.
 * @returns The best value of that suit, or `-1` when the suit is absent.
 */
export function getHighestCardValue( cards: ReadonlyArray<CardId>, suit: CardSuit ) {
	return cards
		.filter( card => getCardSuit( card ) === suit )
		.reduce( ( max, card ) => Math.max( max, getCardValue( card ) ), -1 );
}

/**
 * The seats of a trick in the order they actually played into it.
 *
 * `context.players` is the seating order, which is only the play order for the
 * trick the first seat happens to lead. Every other trick starts wherever the
 * previous one was won, so reading a trick in seat order shows the cards in an
 * order nobody played them in — and the lead card, which decides what everyone
 * else was allowed to follow with, lands in an arbitrary position.
 *
 * @param trick - The trick to read.
 * @param players - The seating order to rotate.
 * @returns The seats, starting at the trick's leader.
 */
export function trickPlayOrder( trick: Trick, players: ReadonlyArray<PlayerId> ) {
	const lead = players.indexOf( trick.leadPlayer );
	if ( lead < 0 ) {
		return players;
	}

	return [ ...players.slice( lead ), ...players.slice( 0, lead ) ];
}

/**
 * The cards a seat may legally play into a trick. Callbreak is stricter than
 * most trick-takers: following suit is not enough, you must head the trick when
 * you can.
 *
 * - Leading, or holding nothing relevant: anything in hand.
 * - Holding the led suit: play it, and play higher than everything of that suit
 *   already down unless a trump has already taken the trick away.
 * - Void in the led suit but holding trump: trump it, and overtrump if a trump
 *   is already down. Unable to overtrump, the seat is free to throw anything.
 *
 * @param hand - The seat's cards.
 * @param trump - The game's trump suit.
 * @param trick - The trick being played into.
 * @returns The subset of `hand` that may be played.
 */
export function getPlayableCards(
	hand: ReadonlyArray<CardId>,
	trump: CardSuit,
	trick: Trick
) {
	const trickCards = Object.values( trick.cards );
	const leadSuit = trick.suit;

	// Leading the trick — any card.
	if ( trickCards.length === 0 || !leadSuit ) {
		return [ ...hand ];
	}

	const suitCards = hand.filter( card => getCardSuit( card ) === leadSuit );

	if ( suitCards.length > 0 ) {
		// A trump on a plain-suit trick has already taken it, so following suit
		// is all that is left to do.
		if ( leadSuit !== trump && trickCards.some( card => getCardSuit( card ) === trump ) ) {
			return suitCards;
		}

		const highestPlayed = getHighestCardValue( trickCards, leadSuit );
		const higherCards = suitCards.filter( card => getCardValue( card ) > highestPlayed );
		return higherCards.length > 0 ? higherCards : suitCards;
	}

	const trumpCards = hand.filter( card => getCardSuit( card ) === trump );

	if ( trumpCards.length > 0 ) {
		const highestTrumpPlayed = getHighestCardValue( trickCards, trump );
		if ( highestTrumpPlayed < 0 ) {
			return trumpCards;
		}

		const higherTrumps = trumpCards.filter(
			card => getCardValue( card ) > highestTrumpPlayed
		);

		return higherTrumps.length > 0 ? higherTrumps : [ ...hand ];
	}

	// Void in the led suit and holding no trump — nothing to enforce.
	return [ ...hand ];
}
