import type { Card, Cost, Tokens } from "@s2h/schema/splendor";

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