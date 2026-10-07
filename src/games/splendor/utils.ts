import * as Array from "effect/Array";
import * as Match from "effect/Match";
import * as Order from "effect/Order";

import { castDraft, produce } from "immer";

import type {
	Card,
	CardLevel,
	CardsByLevel,
	Cost,
	Noble,
	PlayerData,
	SplendorEvent,
	SplendorState,
	Tokens
} from "@/games/splendor/schema";
import { Gem, GemNoGold, SPLENDOR_MAX_RESERVED } from "@/games/splendor/schema";
import type { PlayerId } from "@/swish/schema";


// --- Constants -------------------------------------------------------------

/**
 * The five gems a card can cost and a card can discount. Gold is not one of
 * them: it is a joker paid *with*, never a price asked *in*.
 */
export const GEMS = [ ...GemNoGold.literals ];

/** The five gems plus gold — everything the bank and a seat can hold. */
export const ALL_GEMS = [ ...Gem.literals ];

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


type MutableCost = Record<GemNoGold, number>;

/**
 * A card's id, and a noble's: the level, the prestige and the price, spelled out
 * so two cards are the same card exactly when they are printed the same. Nothing
 * random goes into it, so an id survives a replay unchanged.
 *
 * @param cost The price to spell out.
 */
export function costToString( cost: Cost ) {
	return GEMS.map( gem => `${ gem[ 0 ] }${ cost[ gem ] }` ).join( "-" );
}

/**
 * The noble tiles, drawn for a table of this size: one more than there are
 * seats, so somebody always misses out.
 *
 * @param playerCount How many seats are playing.
 * @param [rng] Randomness source. Pass the game's seeded one to stay deterministic.
 */
export function generateNobles( playerCount: number, rng: () => number = Math.random ) {
	const costs: MutableCost[] = [];

	for ( let i = 0; i < GEMS.length; i++ ) {
		for ( let j = i + 1; j < GEMS.length; j++ ) {
			const cost = { ...DEFAULT_COST };
			cost[ GEMS[ i ]! ] = 4;
			cost[ GEMS[ j ]! ] = 4;
			costs.push( cost );
		}
	}

	for ( let i = 0; i < GEMS.length; i++ ) {
		for ( let j = i + 1; j < GEMS.length; j++ ) {
			for ( let k = j + 1; k < GEMS.length; k++ ) {
				const cost = { ...DEFAULT_COST };
				cost[ GEMS[ i ]! ] = 3;
				cost[ GEMS[ j ]! ] = 3;
				cost[ GEMS[ k ]! ] = 3;
				costs.push( cost );
			}
		}
	}

	const allNobles = costs.map( cost => ( { id: costToString( cost ), points: 3, cost } ) );
	return Array.sort( allNobles, Order.mapInput( Order.Number, rng ) ).slice( 0, playerCount + 1 );
}

const level3MatrixPointMap = {
	3: [
		[ 0, 3, 3, 5, 3 ],
		[ 3, 0, 3, 3, 5 ],
		[ 5, 3, 0, 3, 3 ],
		[ 3, 5, 3, 0, 3 ],
		[ 3, 3, 5, 3, 0 ]
	],
	4: [
		[ 3, 0, 0, 3, 6 ],
		[ 6, 3, 0, 0, 3 ],
		[ 3, 6, 3, 0, 0 ],
		[ 0, 3, 6, 3, 0 ],
		[ 0, 0, 3, 6, 3 ],
		[ 0, 0, 0, 0, 7 ],
		[ 7, 0, 0, 0, 0 ],
		[ 0, 7, 0, 0, 0 ],
		[ 0, 0, 7, 0, 0 ],
		[ 0, 0, 0, 7, 0 ]
	],
	5: [
		[ 3, 0, 0, 0, 7 ],
		[ 7, 3, 0, 0, 0 ],
		[ 0, 7, 3, 0, 0 ],
		[ 0, 0, 7, 3, 0 ],
		[ 0, 0, 0, 7, 3 ]
	]
};

const level2MatrixPointMap = {
	3: [
		[ 6, 0, 0, 0, 0 ],
		[ 0, 6, 0, 0, 0 ],
		[ 0, 0, 6, 0, 0 ],
		[ 0, 0, 0, 6, 0 ],
		[ 0, 0, 0, 0, 6 ]
	],
	2: [
		[ 0, 0, 0, 5, 0 ],
		[ 0, 0, 0, 0, 5 ],
		[ 5, 0, 0, 0, 0 ],
		[ 0, 5, 0, 0, 0 ],
		[ 0, 0, 5, 0, 0 ],
		[ 0, 0, 0, 5, 3 ],
		[ 3, 0, 0, 0, 5 ],
		[ 5, 3, 0, 0, 0 ],
		[ 0, 5, 3, 0, 0 ],
		[ 0, 0, 5, 3, 0 ],
		[ 0, 0, 1, 4, 2 ],
		[ 2, 0, 0, 1, 4 ],
		[ 4, 2, 0, 0, 1 ],
		[ 1, 4, 2, 0, 0 ],
		[ 0, 1, 4, 2, 0 ]
	],
	1: [
		[ 2, 3, 0, 0, 2 ],
		[ 2, 2, 3, 0, 0 ],
		[ 0, 2, 2, 3, 0 ],
		[ 0, 0, 2, 2, 3 ],
		[ 3, 0, 0, 2, 2 ],
		[ 0, 0, 3, 2, 2 ],
		[ 2, 0, 0, 3, 2 ],
		[ 2, 2, 0, 0, 3 ],
		[ 3, 2, 2, 0, 0 ],
		[ 0, 3, 2, 2, 0 ]
	]
};

const level1MatrixPointMap = {
	1: [
		[ 0, 0, 4, 0, 0 ],
		[ 0, 0, 0, 4, 0 ],
		[ 0, 0, 0, 0, 4 ],
		[ 4, 0, 0, 0, 0 ],
		[ 0, 4, 0, 0, 0 ]
	],
	0: [
		[ 0, 0, 0, 3, 0 ],
		[ 0, 0, 0, 0, 3 ],
		[ 3, 0, 0, 0, 0 ],
		[ 0, 3, 0, 0, 0 ],
		[ 0, 0, 3, 0, 0 ],
		[ 0, 1, 1, 1, 1 ],
		[ 1, 0, 1, 1, 1 ],
		[ 1, 1, 0, 1, 1 ],
		[ 1, 1, 1, 0, 1 ],
		[ 1, 1, 1, 1, 0 ],
		[ 0, 1, 2, 1, 1 ],
		[ 1, 0, 1, 2, 1 ],
		[ 1, 1, 0, 1, 2 ],
		[ 2, 1, 1, 0, 1 ],
		[ 1, 2, 1, 1, 0 ],
		[ 0, 2, 2, 0, 1 ],
		[ 1, 0, 2, 2, 0 ],
		[ 0, 1, 0, 2, 2 ],
		[ 2, 0, 1, 0, 2 ],
		[ 2, 2, 0, 1, 0 ],
		[ 3, 0, 1, 0, 1 ],
		[ 1, 3, 0, 1, 0 ],
		[ 0, 1, 3, 0, 1 ],
		[ 1, 0, 1, 3, 0 ],
		[ 0, 1, 0, 1, 3 ],
		[ 0, 2, 0, 0, 2 ],
		[ 2, 0, 2, 0, 0 ],
		[ 0, 2, 0, 2, 0 ],
		[ 0, 0, 2, 0, 2 ],
		[ 2, 0, 0, 2, 0 ],
		[ 0, 0, 2, 1, 0 ],
		[ 0, 0, 0, 2, 1 ],
		[ 1, 0, 0, 0, 2 ],
		[ 2, 1, 0, 0, 0 ],
		[ 0, 2, 1, 0, 0 ]
	]
};

function buildCost( gems: typeof GEMS, costArray: number[] ) {
	return gems.reduce( ( acc, gem, idx ) => {
		acc[ gem ] = costArray[ idx ]!;
		return acc;
	}, { ...DEFAULT_COST } );
}

function generateDeckForMatrixPointMap(
	gems: typeof GEMS,
	level: CardLevel,
	map: Record<number, number[][]>
) {
	return Object.keys( map )
		.map( p => parseInt( p ) )
		.flatMap( ( points ) => map[ points ]!.map( ( costArray, idx ) => {
			const bonus = gems[ idx % 5 ]!;
			const cost = buildCost( gems, costArray );
			const id = `L${ level }-P${ points }-${ costToString( cost ) }-B${ bonus.charAt( 0 ) }`;
			return { id, level, points, cost, bonus };
		} ) );
}

/**
 * The three development decks — 40 / 30 / 20 cards — shuffled. The gem labels
 * are permuted too, so which colour a given cost pattern belongs to changes
 * between games while the distribution stays the printed one.
 *
 * @param [rng] Randomness source. Pass the game's seeded one to stay deterministic.
 */
export function generateDecks( rng: () => number = Math.random ) {
	const gems = Array.sort( GEMS, Order.mapInput( Order.Number, rng ) );
	return {
		3: Array.sort(
			generateDeckForMatrixPointMap( gems, 3, level3MatrixPointMap ),
			Order.mapInput( Order.Number, rng )
		),
		2: Array.sort(
			generateDeckForMatrixPointMap( gems, 2, level2MatrixPointMap ),
			Order.mapInput( Order.Number, rng )
		),
		1: Array.sort(
			generateDeckForMatrixPointMap( gems, 1, level1MatrixPointMap ),
			Order.mapInput( Order.Number, rng )
		)
	};
}


// --- Board lookups ---------------------------------------------------------

/**
 * Find a face-up card by id, across all three rows.
 *
 * @param cardId The id being looked for.
 * @param cards The face-up cards.
 */
export const findOpenCard = ( cardId: string, cards: CardsByLevel ) => {
	for ( const level of [ 1, 2, 3 ] as const ) {
		const card = cards[ level ].find( c => c.id === cardId );
		if ( card ) {
			return card;
		}
	}

	return undefined;
};

/**
 * Find a card a player is holding in reserve, by id.
 *
 * @param cardId The id being looked for.
 * @param player The player's data.
 */
export const findReservedCard = ( cardId: string, player: PlayerData ) =>
	player.reserved.find( card => card.id === cardId );


// --- Reducer helpers -------------------------------------------------------

/** Remove one card by id from a level's deck in place (immer draft array). */
const dropDeckCard = ( deck: Card[], card: Card | null ) => {
	if ( card === null ) {
		return;
	}

	const idx = deck.findIndex( c => c.id === card.id );
	if ( idx >= 0 ) {
		deck.splice( idx, 1 );
	}
};

/** Replace an open slot (by removed card id) with `replacement`, or drop it, in place. */
const refillOpenCard = ( open: Card[], removed: Card, replacement: Card | null ) => {
	const idx = open.findIndex( c => c.id === removed.id );
	if ( idx < 0 ) {
		return;
	}

	if ( replacement === null ) {
		open.splice( idx, 1 );
	} else {
		open[ idx ] = replacement;
	}
};

/** Move `count` of a gem from the bank to a seat, or back when negative. */
const moveTokens = (
	draft: { tokens: Record<string, number> },
	player: { tokens: Record<string, number> },
	tokens: Partial<Record<string, number>>,
	direction: 1 | -1
) => {
	for ( const gem of ALL_GEMS ) {
		const count = tokens[ gem ] ?? 0;
		if ( count > 0 ) {
			player.tokens[ gem ] = ( player.tokens[ gem ] ?? 0 ) + direction * count;
			draft.tokens[ gem ] = ( draft.tokens[ gem ] ?? 0 ) - direction * count;
		}
	}
};


// --- Reducer ---------------------------------------------------------------

/** Pure reducer — the ONLY place `state` changes. Mutations are on an immer draft. */
export const apply = ( state: SplendorState, event: SplendorEvent ) =>
	produce( state, ( draft ) => {
		Match.value( event ).pipe(
			Match.tag( "splendor/ev/PlayerDataInitialized", ( e ) => {
				draft.playerData[ e.playerId ] = {
					tokens: { ...DEFAULT_TOKENS },
					cards: [],
					nobles: [],
					reserved: [],
					points: 0
				};
			} ),
			Match.tag( "splendor/ev/GameDealt", ( e ) => {
				draft.tokens = castDraft( e.tokens );
				draft.nobles = castDraft( e.nobles );
				draft.cards = castDraft( e.cards );
				draft.decks = castDraft( e.decks );
			} ),
			Match.tag( "splendor/ev/TokensPicked", ( e ) => {
				const player = draft.playerData[ e.playerId ]!;
				moveTokens( draft, player, e.tokens, 1 );
				if ( e.returned ) {
					moveTokens( draft, player, e.returned, -1 );
				}
			} ),
			Match.tag( "splendor/ev/CardReserved", ( e ) => {
				const player = draft.playerData[ e.playerId ]!;
				const level = e.card.level;

				if ( e.withGold ) {
					player.tokens.gold += 1;
					draft.tokens.gold -= 1;
				}

				if ( e.returnedToken ) {
					player.tokens[ e.returnedToken ] -= 1;
					draft.tokens[ e.returnedToken ] += 1;
				}

				refillOpenCard( draft.cards[ level ], castDraft( e.card ), castDraft( e.replacement ) );
				dropDeckCard( draft.decks[ level ], castDraft( e.replacement ) );
				player.reserved.push( castDraft( e.card ) );
			} ),
			Match.tag( "splendor/ev/CardPurchased", ( e ) => {
				const player = draft.playerData[ e.playerId ]!;
				const level = e.card.level;

				moveTokens( draft, player, e.payment, -1 );

				if ( e.fromReserved ) {
					const idx = player.reserved.findIndex( card => card.id === e.card.id );
					if ( idx >= 0 ) {
						player.reserved.splice( idx, 1 );
					}
				} else {
					refillOpenCard( draft.cards[ level ], castDraft( e.card ), castDraft( e.replacement ) );
					dropDeckCard( draft.decks[ level ], castDraft( e.replacement ) );
				}

				player.cards.push( castDraft( e.card ) );
				player.points += e.card.points;
			} ),
			Match.tag( "splendor/ev/NobleVisited", ( e ) => {
				const player = draft.playerData[ e.playerId ]!;
				const idx = draft.nobles.findIndex( n => n.id === e.noble.id );
				if ( idx >= 0 ) {
					draft.nobles.splice( idx, 1 );
				}

				player.nobles.push( castDraft( e.noble ) );
				player.points += e.noble.points;
			} ),
			Match.exhaustive
		);
	} );

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
 * The winner: the top of {@link rankPlayers}, but only when it *is* a top. Two
 * seats level on both prestige and card count have won together, and the rules
 * say so rather than breaking it further — so nobody is named.
 *
 * @param players The roster, in seating order.
 * @param playerData Every seat's data.
 */
export function decideWinner(
	players: ReadonlyArray<PlayerId>,
	playerData: SplendorState[ "playerData" ]
) {
	const [ top, runnerUp ] = rankPlayers( players, playerData );
	if ( !top ) {
		return undefined;
	}

	const tied = runnerUp !== undefined
		&& compareStandings( playerData[ top ], playerData[ runnerUp ] ) === 0;

	return tied ? undefined : top;
}

/**
 * The final table: seats best-first, each stamped with its prestige and its
 * place. Ranking is standard competition style — seats level on both keys share
 * a place and the next one down skips it — which is what makes a shared victory
 * read as two seats at rank 1 with no winner named.
 *
 * @param players The roster, in seating order.
 * @param playerData Every seat's data.
 */
export function standingsFor(
	players: ReadonlyArray<PlayerId>,
	playerData: SplendorState[ "playerData" ]
) {
	let rank = 1;
	let previous: PlayerId | undefined;

	const ranking = rankPlayers( players, playerData ).map( ( playerId, index ) => {
		if ( previous !== undefined
			&& compareStandings( playerData[ previous ], playerData[ playerId ] ) !== 0 ) {
			rank = index + 1;
		}

		previous = playerId;
		return { playerId, rank, score: playerData[ playerId ]?.points ?? 0 };
	} );

	return { ranking, winner: decideWinner( players, playerData ) };
}
