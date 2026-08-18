import * as Match from "effect/Match";
import { castDraft, produce } from "immer";

import {
	ALL_GEMS,
	DEFAULT_COST,
	DEFAULT_TOKENS,
	GEMS
} from "@/games/splendor/shared/utils.ts";
import { shuffle } from "@/shared/utils/array.ts";

import type {
	Card,
	CardLevel,
	CardsByLevel,
	Cost,
	GemNoGold,
	PlayerData,
	SplendorEvent,
	SplendorState
} from "@/games/splendor/shared/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";

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
export function generateNobles( playerCount: number, rng?: () => number ) {
	const costs: MutableCost[] = [];

	for ( let i = 0; i < GEMS.length; i++ ) {
		for ( let j = i + 1; j < GEMS.length; j++ ) {
			const cost = { ...DEFAULT_COST };
			cost[ GEMS[ i ] ] = 4;
			cost[ GEMS[ j ] ] = 4;
			costs.push( cost );
		}
	}

	for ( let i = 0; i < GEMS.length; i++ ) {
		for ( let j = i + 1; j < GEMS.length; j++ ) {
			for ( let k = j + 1; k < GEMS.length; k++ ) {
				const cost = { ...DEFAULT_COST };
				cost[ GEMS[ i ] ] = 3;
				cost[ GEMS[ j ] ] = 3;
				cost[ GEMS[ k ] ] = 3;
				costs.push( cost );
			}
		}
	}

	const allNobles = costs.map( cost => ( { id: costToString( cost ), points: 3, cost } ) );
	return shuffle( allNobles, rng ).slice( 0, playerCount + 1 );
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
		acc[ gem ] = costArray[ idx ];
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
		.flatMap( ( points ) => map[ points ].map( ( costArray, idx ) => {
			const bonus = gems[ idx % 5 ];
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
export function generateDecks( rng?: () => number ) {
	const gems = shuffle( GEMS, rng );
	return {
		3: shuffle( generateDeckForMatrixPointMap( gems, 3, level3MatrixPointMap ), rng ),
		2: shuffle( generateDeckForMatrixPointMap( gems, 2, level2MatrixPointMap ), rng ),
		1: shuffle( generateDeckForMatrixPointMap( gems, 1, level1MatrixPointMap ), rng )
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
			player.tokens[ gem ] += direction * count;
			draft.tokens[ gem ] -= direction * count;
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
