import {
	SPLENDOR_MAX_RESERVED,
	SPLENDOR_MAX_TOKENS,
	SPLENDOR_NOBLE_VISIT
} from "@/games/splendor/shared/schema.ts";
import {
	ALL_GEMS,
	DEFAULT_TOKENS,
	discountedCost,
	GEMS,
	paymentFor,
	qualifiesForNoble,
	qualifyingNobles,
	sumTokens
} from "@/games/splendor/shared/utils.ts";

import type {
	Card,
	Gem,
	GemNoGold,
	PartialTokens,
	PlayerData,
	ReserveCardInput,
	SplendorView
} from "@/games/splendor/shared/schema.ts";
import type { GameContext } from "@/swish/shared/schema.ts";

/** The face-up cards, flattened. */
const openCards = ( view: SplendorView ) => [
	...view.cards[ 1 ],
	...view.cards[ 2 ],
	...view.cards[ 3 ]
];

/**
 * What a card is worth to this seat right now: its prestige, plus the noble it
 * would bring in, plus a little for the discount it leaves behind. Cheap cards
 * win ties, so the bot builds an engine before it chases points.
 */
const valueOf = ( card: Card, me: PlayerData, view: SplendorView ) => {
	const owned = [ ...me.cards, card ];
	const noble = view.nobles.some( n => qualifiesForNoble( owned, n.cost ) ) ? 3 : 0;
	const price = GEMS.reduce( ( total, gem ) => total + discountedCost( card, me.cards )[ gem ], 0 );

	return ( card.points * 10 ) + ( noble * 10 ) + ( 4 - card.level ) - price;
};

/**
 * Which gems this seat is short of, most wanted first: every face-up card's
 * remaining price, summed. A gem nothing on the board asks for scores zero, so
 * the bot stops hoarding it.
 */
const demandFor = ( me: PlayerData, view: SplendorView ) => {
	const demand: Record<GemNoGold, number> = {
		diamond: 0,
		sapphire: 0,
		emerald: 0,
		ruby: 0,
		onyx: 0
	};

	for ( const card of openCards( view ) ) {
		const cost = discountedCost( card, me.cards );
		for ( const gem of GEMS ) {
			demand[ gem ] += Math.max( 0, cost[ gem ] - me.tokens[ gem ] );
		}
	}

	return demand;
};

/**
 * What to put back when a take would carry the seat over the ten-token limit:
 * whatever it holds most of and wants least. Never more than it holds, and
 * exactly as many as the limit demands.
 *
 * @param held What the seat would hold once the take lands.
 * @param excess How many have to go back.
 * @param demand How badly each gem is wanted.
 */
const discard = (
	held: Record<string, number>,
	excess: number,
	demand: Record<GemNoGold, number>
) => {
	const returned: Record<string, number> = {};
	// Gold last: it is the only token that pays for anything.
	const order: Array<Gem> = [
		...GEMS.toSorted( ( a, b ) => demand[ a ] - demand[ b ] ),
		"gold"
	];

	let left = excess;
	for ( const gem of order ) {
		if ( left === 0 ) {
			break;
		}

		const back = Math.min( left, held[ gem ] ?? 0 );
		if ( back > 0 ) {
			returned[ gem ] = back;
			left -= back;
		}
	}

	return returned as PartialTokens;
};

/**
 * A greedy Splendor policy: settle any noble waiting on the seat, then buy
 * whatever is worth most and affordable, else take the gems the board is asking
 * for, else reserve the best card on the table, else pass.
 *
 * It sees the seat's own view and nothing more, so it plays with exactly the
 * information the player it stands in for would have.
 *
 * The engine dies on an illegal move from a policy, so every branch here builds
 * a move the rules already accept rather than one `validate` has to catch:
 * payments come from `paymentFor`, takes are sized to what the bank actually
 * holds, and a discard is computed against the post-take purse.
 *
 * The branches below mirror `hasLegalMove` one for one, which is what makes the
 * final `pass` legal by construction: it is only reached when every other branch
 * declined, and those are the same three questions `validate` asks.
 *
 * @param view The acting seat's view of the table.
 * @param context The engine's context, which is where an open frame lives.
 * @returns The move to play, or `undefined` when a frame is open with no answer
 * 		the policy can give — passing is not a response, so the engine settles it.
 */
export const decideMove = ( view: SplendorView, context: GameContext ) => {
	const me = view.playerId ? view.playerData[ view.playerId ] : undefined;
	if ( !me ) {
		return undefined;
	}

	// 0. A noble is waiting on a choice. Nothing else is legal until it is made,
	// and every option is worth the same three points, so take the first.
	const [ frame ] = context.interactions.slice( -1 );
	if ( frame?.kind === SPLENDOR_NOBLE_VISIT ) {
		const [ noble ] = qualifyingNobles( me.cards, view.nobles );

		return noble
			? { moveType: "claimNoble" as const, input: { nobleId: noble.id } }
			: undefined;
	}

	// 1. Buy: the best card the seat can already pay for, board or reserve.
	const buyable = [ ...openCards( view ), ...me.reserved ]
		.map( card => ( { card, payment: paymentFor( card, me.tokens, me.cards ) } ) )
		.filter( ( entry ): entry is { card: Card; payment: Record<string, number> } =>
			entry.payment !== undefined )
		.sort( ( a, b ) => valueOf( b.card, me, view ) - valueOf( a.card, me, view ) );

	const [ best ] = buyable;
	if ( best ) {
		return {
			moveType: "purchaseCard" as const,
			input: { cardId: best.card.id, payment: best.payment as PartialTokens }
		};
	}

	const demand = demandFor( me, view );
	const held = sumTokens( me.tokens );

	// 2. Take gems: three different ones, or two of a kind when that is all there is.
	const available = GEMS.filter( gem => view.tokens[ gem ] > 0 )
		.sort( ( a, b ) => demand[ b ] - demand[ a ] );

	if ( available.length > 0 ) {
		const tokens: Record<string, number> = {};
		if ( available.length === 1 ) {
			const [ only ] = available;
			tokens[ only ] = view.tokens[ only ] >= 4 ? 2 : 1;
		} else {
			for ( const gem of available.slice( 0, 3 ) ) {
				tokens[ gem ] = 1;
			}
		}

		const taken = sumTokens( tokens );
		const excess = Math.max( 0, held + taken - SPLENDOR_MAX_TOKENS );
		const after = { ...DEFAULT_TOKENS };
		for ( const gem of ALL_GEMS ) {
			after[ gem ] = me.tokens[ gem ] + ( tokens[ gem ] ?? 0 );
		}

		return {
			moveType: "pickTokens" as const,
			input: {
				tokens: tokens as PartialTokens,
				returned: excess > 0 ? discard( after, excess, demand ) : undefined
			}
		};
	}

	// 3. Reserve: nothing to buy and an empty bank, so bank a card and the gold.
	if ( me.reserved.length < SPLENDOR_MAX_RESERVED ) {
		const [ target ] = openCards( view )
			.toSorted( ( a, b ) => valueOf( b, me, view ) - valueOf( a, me, view ) );

		if ( target ) {
			const withGold = view.tokens.gold > 0;
			const excess = Math.max( 0, held + ( withGold ? 1 : 0 ) - SPLENDOR_MAX_TOKENS );
			const after = { ...me.tokens, gold: me.tokens.gold + ( withGold ? 1 : 0 ) };
			const [ returnedToken ] = Object.keys( discard( after, excess, demand ) );

			return {
				moveType: "reserveCard" as const,
				input: {
					cardId: target.id,
					withGold,
					returnedToken: returnedToken as ReserveCardInput[ "returnedToken" ]
				}
			};
		}
	}

	// 4. Nothing to buy, an empty bank and no room to reserve. The rules have run
	// out of turns to take, which is exactly when passing is allowed.
	return { moveType: "pass" as const, input: {} };
};
