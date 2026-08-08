import type { Card, Cost, PlayerData, SplendorState, Tokens } from "@/games/splendor/shared/schema.ts";
import type { PlayerId } from "@/shared/swish/schema.ts";

export const GEMS: Array<keyof Cost> = [ "diamond", "sapphire", "emerald", "ruby", "onyx" ];
export const GEMS_WITH_GOLD: Array<keyof Tokens> = [ ...GEMS, "gold" ];
export const DEFAULT_COST: Cost = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 };
export const DEFAULT_TOKENS: Tokens = {
	diamond: 0,
	sapphire: 0,
	emerald: 0,
	ruby: 0,
	onyx: 0,
	gold: 0
};


/**
 * Check if a given card can be purchased with the available
 * tokens and discount
 * @param card The card to purchase
 * @param tokens The tokens in hand
 * @param discounts Already purchased cards
 */
export function canPurchaseCard( card: Card, tokens: Tokens, discounts: Card[] ) {
	const gems = Object.keys( card.cost ).map( g => g as keyof Cost );
	const canWithoutGold = gems.every( gem => {
		const discountsForGem = discounts.filter( c => c.bonus === gem ).length;
		return tokens[ gem ] + discountsForGem >= card.cost[ gem ];
	} );

	const goldNeeded = gems.reduce( ( total, gem ) => {
		const discountsForGem = discounts.filter( c => c.bonus === gem ).length;
		return total + Math.max( 0, card.cost[ gem ] - tokens[ gem ] - discountsForGem );
	}, 0 );

	return canWithoutGold || ( ( tokens.gold || 0 ) >= goldNeeded );
}

/**
 * Check if the proposed payment exactly covers the card's cost.
 * Discounts from owned cards reduce the required cost per gem.
 * No overpayment is allowed: each gem paid must not exceed its
 * discounted cost, and gold must exactly equal the remaining
 * shortfall (no more, no less).
 *
 * @param card The card being purchased
 * @param payment Tokens the player is offering as payment
 * @param discounts Already purchased cards (provide per-gem discounts)
 */
export function isValidPayment( card: Card, payment: Partial<Tokens>, discounts: Card[] ) {
	const gems = Object.keys( card.cost ).map( g => g as keyof Cost );

	let totalShortfall = 0;
	for ( const gem of gems ) {
		const discountsForGem = discounts.filter( c => c.bonus === gem ).length;
		const costAfterDiscount = Math.max( 0, card.cost[ gem ] - discountsForGem );
		const paid = payment[ gem ] ?? 0;

		if ( paid > costAfterDiscount ) {
			return false;
		}

		totalShortfall += costAfterDiscount - paid;
	}

	return ( payment.gold ?? 0 ) === totalShortfall;
}

// --- Standings -------------------------------------------------------------

/**
 * How many development cards a player bought. This is the official tie-break
 * quantity: only purchased cards count — nobles are not development cards, and
 * a reserved card was never bought.
 *
 * @param player The player's data (absent seats count as zero).
 */
export function developmentCardCount( player?: PlayerData ) {
	return player?.cards.length ?? 0;
}

/**
 * Order two seats best-first at the end of a game. Most prestige points wins;
 * on a tie the rules award it to whoever spent *fewer* development cards
 * getting there. Two seats that are still level compare equal, so a stable
 * sort leaves them in seating order.
 *
 * @param a The first player's data.
 * @param b The second player's data.
 * @returns Negative when `a` outranks `b`, positive when `b` outranks `a`.
 */
export function compareStandings( a?: PlayerData, b?: PlayerData ) {
	const byPoints = ( b?.points ?? 0 ) - ( a?.points ?? 0 );
	if ( byPoints !== 0 ) {
		return byPoints;
	}

	return developmentCardCount( a ) - developmentCardCount( b );
}

/**
 * Rank the roster best-first, applying the points → fewest-cards tie-break.
 * `toSorted` is stable, so seats that tie on both keys stay in seating order.
 *
 * @param players The roster, in seating order.
 * @param playerData Every seat's data.
 */
export function rankPlayers(
	players: ReadonlyArray<PlayerId>,
	playerData: SplendorState[ "playerData" ]
) {
	return players.toSorted( ( a, b ) => compareStandings( playerData[ a ], playerData[ b ] ) );
}

/**
 * The winner: the top of {@link rankPlayers}, or `undefined` for an empty roster.
 *
 * @param players The roster, in seating order.
 * @param playerData Every seat's data.
 */
export function decideWinner(
	players: ReadonlyArray<PlayerId>,
	playerData: SplendorState[ "playerData" ]
) {
	return rankPlayers( players, playerData )[ 0 ];
}