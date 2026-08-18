import { Gem, GemNoGold, SPLENDOR_MAX_RESERVED } from "@/games/splendor/shared/schema.ts";

import type {
	Card,
	Noble,
	PlayerData,
	SplendorState,
	Tokens
} from "@/games/splendor/shared/schema.ts";

// --- Constants -------------------------------------------------------------

/**
 * The five gems a card can cost and a card can discount. Gold is not one of
 * them: it is a joker paid *with*, never a price asked *in*.
 */
export const GEMS: Array<GemNoGold> = [ ...GemNoGold.literals ];

/** The five gems plus gold — everything the bank and a seat can hold. */
export const ALL_GEMS: Array<Gem> = [ ...Gem.literals ];

/** An empty price. Spread it rather than mutating it. */
export const DEFAULT_COST: Record<GemNoGold, number> = {
	diamond: 0,
	sapphire: 0,
	emerald: 0,
	ruby: 0,
	onyx: 0
};

/** An empty purse. Spread it rather than mutating it. */
export const DEFAULT_TOKENS: Record<Gem, number> = {
	...DEFAULT_COST,
	gold: 0
};


// --- Tokens and costs ------------------------------------------------------

/**
 * Sum every entry of a (partial) token map.
 *
 * @param tokens The map to total. Absent entries count as zero.
 */
export const sumTokens = ( tokens: Partial<Record<Gem, number>> ) =>
	ALL_GEMS.reduce( ( total, gem ) => total + ( tokens[ gem ] ?? 0 ), 0 );

/**
 * The permanent discount a set of bought cards gives, one entry per gem.
 *
 * @param owned The cards the player has bought.
 */
export const bonusesFor = ( owned: ReadonlyArray<Card> ) => {
	const bonuses = { ...DEFAULT_COST };
	for ( const card of owned ) {
		bonuses[ card.bonus ]++;
	}

	return bonuses;
};

/**
 * What a card actually costs this player, after their bought cards discount it.
 * Never negative: a surplus discount is simply wasted.
 *
 * @param card The card being priced.
 * @param owned The cards the player has bought.
 */
export const discountedCost = ( card: Card, owned: ReadonlyArray<Card> ) => {
	const bonuses = bonusesFor( owned );
	const cost = { ...DEFAULT_COST };
	for ( const gem of GEMS ) {
		cost[ gem ] = Math.max( 0, card.cost[ gem ] - bonuses[ gem ] );
	}

	return cost;
};

/**
 * The payment a player would make buying a card the cheapest way: every gem they
 * hold goes first, gold covers whatever is still short. `undefined` when they
 * cannot cover it at all.
 *
 * This is the canonical spelling of a payment — a seat holding both gems and
 * gold may deliberately spend the gold instead, which is why `purchaseCard`
 * takes the payment rather than deriving it, but it is what a client should
 * offer and what the bot plays.
 *
 * @param card The card being bought.
 * @param tokens The tokens the player holds.
 * @param owned The cards the player has bought.
 */
export const paymentFor = ( card: Card, tokens: Tokens, owned: ReadonlyArray<Card> ) => {
	const cost = discountedCost( card, owned );
	const payment: Record<Gem, number> = { ...DEFAULT_TOKENS };

	let shortfall = 0;
	for ( const gem of GEMS ) {
		const paid = Math.min( tokens[ gem ], cost[ gem ] );
		payment[ gem ] = paid;
		shortfall += cost[ gem ] - paid;
	}

	if ( shortfall > tokens.gold ) {
		return undefined;
	}

	payment.gold = shortfall;
	return payment;
};

/**
 * Whether a player can buy a card at all, gold included.
 *
 * @param card The card being bought.
 * @param tokens The tokens the player holds.
 * @param owned The cards the player has bought.
 */
export const canPurchaseCard = ( card: Card, tokens: Tokens, owned: ReadonlyArray<Card> ) =>
	paymentFor( card, tokens, owned ) !== undefined;

/**
 * Whether a proposed payment settles a card exactly. No gem may be overpaid past
 * its discounted price, and gold must cover the remaining shortfall to the token
 * — no more, no less — so there is exactly one legal payment per split of gems
 * and gold and none of them leaks value into the bank.
 *
 * Affordability is a separate question: this says the payment is *correct*, not
 * that the player holds it.
 *
 * @param card The card being bought.
 * @param payment The tokens offered.
 * @param owned The cards the player has bought.
 */
export const isValidPayment = (
	card: Card,
	payment: Partial<Record<Gem, number>>,
	owned: ReadonlyArray<Card>
) => {
	const cost = discountedCost( card, owned );

	let shortfall = 0;
	for ( const gem of GEMS ) {
		const paid = payment[ gem ] ?? 0;
		if ( paid > cost[ gem ] ) {
			return false;
		}

		shortfall += cost[ gem ] - paid;
	}

	return ( payment.gold ?? 0 ) === shortfall;
};

/**
 * Whether a set of bought cards satisfies a noble's requirements.
 *
 * @param owned The cards the player has bought.
 * @param cost The noble's gem requirements.
 */
export const qualifiesForNoble = (
	owned: ReadonlyArray<Card>,
	cost: Record<GemNoGold, number>
) => {
	const bonuses = bonusesFor( owned );
	return GEMS.every( gem => bonuses[ gem ] >= cost[ gem ] );
};

/**
 * Whether a seat has any turn it could legally take.
 *
 * There are exactly three things to do on a Splendor turn, and this asks each in
 * the order it is cheapest to answer:
 *
 * - take gems, which needs one gem left in the bank and nothing else. The
 * 		ten-token limit never blocks it: a seat already at ten takes and hands the
 * 		same tokens straight back. Gold does not count — it is only ever taken with
 * 		a reservation
 * - reserve, which needs a card face up and room under the three-card limit.
 * 		Taking the gold with it is optional, so a full purse does not block it
 * 		either
 * - buy, which needs one card on the board or in the seat's own reserve that its
 * 		tokens and discounts cover
 *
 * `false` is what makes `pass` legal, and it is a shared condition rather than a
 * personal one: the bank and the board are the same for everybody, so no seat is
 * ever stuck while a single gem is left in the bank.
 *
 * @param table The bank and the face-up cards. A `SplendorView` fits as-is.
 * @param player The seat being asked about.
 */
export const hasLegalMove = (
	table: Pick<SplendorState, "tokens" | "cards">,
	player: PlayerData
) => {
	if ( GEMS.some( gem => table.tokens[ gem ] > 0 ) ) {
		return true;
	}

	const open = [ ...table.cards[ 1 ], ...table.cards[ 2 ], ...table.cards[ 3 ] ];
	if ( player.reserved.length < SPLENDOR_MAX_RESERVED && open.length > 0 ) {
		return true;
	}

	return [ ...open, ...player.reserved ]
		.some( card => canPurchaseCard( card, player.tokens, player.cards ) );
};

/**
 * Every unclaimed noble willing to visit this set of bought cards, in the order
 * they sit on the table.
 *
 * All of them rather than the first, because the rules give the choice to the
 * player when more than one qualifies — see the `noble-visit` interaction — and
 * a client wants the same list to offer it.
 *
 * @param owned The cards the player has bought.
 * @param nobles The nobles still unclaimed.
 */
export const qualifyingNobles = (
	owned: ReadonlyArray<Card>,
	nobles: ReadonlyArray<Noble>
) => nobles.filter( noble => qualifiesForNoble( owned, noble.cost ) );
