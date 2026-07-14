import { shuffle } from "@s2h/utils/array";
import * as Match from "effect/Match";
import type {
	Card,
	CardLevel,
	CardsByLevel,
	Cost,
	GemNoGold,
	Noble,
	PlayerData,
	SplendorEvent,
	SplendorState,
	Tokens
} from "./schema";

// Locally-mutable variants of the deeply-readonly schema types, used by the
// pure builders/reducer below (the schema `.Type`s are deeply readonly).
type MutableCost = Record<GemNoGold, number>;
type MutableTokens = Record<Gem, number>;

export const GEMS: Array<keyof Cost> = [ "diamond", "sapphire", "emerald", "ruby", "onyx" ];
export const GEMS_WITH_GOLD: Array<keyof Tokens> = [ ...GEMS, "gold" ];
export const DEFAULT_COST: MutableCost = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 };
export const DEFAULT_TOKENS: MutableTokens = {
	diamond: 0,
	sapphire: 0,
	emerald: 0,
	ruby: 0,
	onyx: 0,
	gold: 0
};

type Gem = keyof Tokens;
const ALL_GEMS: ReadonlyArray<Gem> = [ "diamond", "sapphire", "emerald", "ruby", "onyx", "gold" ];

export function costToString( cost: Cost ) {
	return GEMS.map( gem => `${ gem[ 0 ] }${ cost[ gem ] }` ).join( "-" );
}

export function generateNobles( playerCount: number ): Noble[] {
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
	return shuffle( allNobles ).slice( 0, playerCount + 1 );
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

function buildCost( gems: typeof GEMS, costArray: number[] ): MutableCost {
	return gems.reduce( ( acc, gem, idx ) => {
		acc[ gem ] = costArray[ idx ];
		return acc;
	}, { ...DEFAULT_COST } );
}

function generateDeckForMatrixPointMap(
	gems: typeof GEMS,
	level: CardLevel,
	map: Record<number, number[][]>
): Card[] {
	return Object.keys( map )
		.map( p => parseInt( p ) )
		.flatMap( ( points ) => map[ points ].map( ( costArray, idx ) => {
			const bonus = gems[ idx % 5 ];
			const cost = buildCost( gems, costArray );
			const id = `L${ level }-P${ points }-${ costToString( cost ) }-B${ bonus.charAt( 0 ) }`;
			return { id, level, points, cost, bonus };
		} ) );
}

export function generateDecks(): Record<CardLevel, Card[]> {
	const gems = shuffle( GEMS );
	return {
		3: shuffle( generateDeckForMatrixPointMap( gems, 3, level3MatrixPointMap ) ),
		2: shuffle( generateDeckForMatrixPointMap( gems, 2, level2MatrixPointMap ) ),
		1: shuffle( generateDeckForMatrixPointMap( gems, 1, level1MatrixPointMap ) )
	};
}

function getPlayerBonuses( player: PlayerData ): MutableCost {
	const bonuses: MutableCost = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 };
	for ( const card of player.cards ) {
		bonuses[ card.bonus ]++;
	}
	return bonuses;
}

export function checkNobleVisit( player: PlayerData, nobles: ReadonlyArray<Noble> ): string | undefined {
	const bonuses = getPlayerBonuses( player );

	for ( const noble of nobles ) {
		const qualifies = GEMS.every( gem => bonuses[ gem ] >= noble.cost[ gem ] );
		if ( qualifies ) {
			return noble.id;
		}
	}

	return undefined;
}


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

// --- Decider-side pure helpers ---------------------------------------------

/** Sum every value of a (partial) token map. */
export const sumTokens = ( t: Partial<Record<Gem, number>> ): number =>
	Object.values( t ).reduce( ( acc, v ) => acc + ( v ?? 0 ), 0 );

/** Find an open card by id across all three levels (readonly-safe). */
export const findOpenCard = ( cardId: string, cards: CardsByLevel ): Card | undefined => {
	for ( const level of [ 1, 2, 3 ] as const ) {
		const card = cards[ level ].find( c => c.id === cardId );
		if ( card ) {
			return card;
		}
	}
	return undefined;
};

/** Discounted cost of a card given the buyer's owned bonus cards. */
export const discountedCost = ( card: Card, owned: ReadonlyArray<Card> ): MutableCost => {
	const result: MutableCost = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 };
	for ( const gem of GEMS ) {
		const discount = owned.filter( c => c.bonus === gem ).length;
		result[ gem ] = Math.max( 0, card.cost[ gem ] - discount );
	}
	return result;
};

/** First noble whose gem requirements the player's owned cards satisfy. */
export const findNobleVisit = (
	owned: ReadonlyArray<Card>,
	nobles: ReadonlyArray<Noble>
): Noble | null => {
	for ( const noble of nobles ) {
		const qualifies = GEMS.every( gem =>
			owned.filter( c => c.bonus === gem ).length >= noble.cost[ gem ] );
		if ( qualifies ) {
			return noble;
		}
	}
	return null;
};

/** Remove one card by id from a level's deck (pure). */
const dropFromDeck = ( deck: ReadonlyArray<Card>, card: Card | null ): ReadonlyArray<Card> =>
	card === null ? deck : deck.filter( c => c.id !== card.id );

/** Replace an open slot (by removed card id) with `replacement` (or drop it). */
const refillOpen = (
	open: ReadonlyArray<Card>,
	removed: Card,
	replacement: Card | null
): ReadonlyArray<Card> => {
	const idx = open.findIndex( c => c.id === removed.id );
	if ( idx < 0 ) {
		return open;
	}
	const next = [ ...open ];
	if ( replacement === null ) {
		next.splice( idx, 1 );
	} else {
		next[ idx ] = replacement;
	}
	return next;
};

// --- Reducer ---------------------------------------------------------------

/** Pure reducer — the ONLY place `state` changes. No Effect, no Random. */
export const apply = ( state: SplendorState, event: SplendorEvent ): SplendorState =>
	Match.value( event ).pipe(
		Match.tag( "splendor/evt/PlayerDataInitialized", ( e ) => ( {
			...state,
			playerData: {
				...state.playerData,
				[ e.playerId ]: {
					tokens: { ...DEFAULT_TOKENS },
					cards: [],
					nobles: [],
					reserved: [],
					points: 0
				}
			}
		} ) ),
		Match.tag( "splendor/evt/GameDealt", ( e ) => ( {
			...state,
			tokens: e.tokens,
			nobles: e.nobles,
			cards: e.cards,
			decks: e.decks
		} ) ),
		Match.tag( "splendor/evt/TokensPicked", ( e ) => {
			const player = state.playerData[ e.playerId ]!;
			const tokens: MutableTokens = { ...state.tokens };
			const playerTokens: MutableTokens = { ...player.tokens };
			for ( const gem of ALL_GEMS ) {
				const take = e.tokens[ gem ] ?? 0;
				if ( take > 0 ) {
					playerTokens[ gem ] += take;
					tokens[ gem ] -= take;
				}
			}
			if ( e.returned ) {
				for ( const gem of ALL_GEMS ) {
					const ret = e.returned[ gem ] ?? 0;
					if ( ret > 0 ) {
						playerTokens[ gem ] -= ret;
						tokens[ gem ] += ret;
					}
				}
			}
			return {
				...state,
				tokens,
				playerData: { ...state.playerData, [ e.playerId ]: { ...player, tokens: playerTokens } }
			};
		} ),
		Match.tag( "splendor/evt/CardReserved", ( e ) => {
			const player = state.playerData[ e.playerId ]!;
			const level = e.card.level;
			const tokens: MutableTokens = { ...state.tokens };
			const playerTokens: MutableTokens = { ...player.tokens };
			if ( e.withGold ) {
				playerTokens.gold += 1;
				tokens.gold -= 1;
			}
			if ( e.returnedToken ) {
				playerTokens[ e.returnedToken ] -= 1;
				tokens[ e.returnedToken ] += 1;
			}
			return {
				...state,
				tokens,
				cards: { ...state.cards, [ level ]: refillOpen( state.cards[ level ], e.card, e.replacement ) },
				decks: { ...state.decks, [ level ]: dropFromDeck( state.decks[ level ], e.replacement ) },
				playerData: {
					...state.playerData,
					[ e.playerId ]: { ...player, tokens: playerTokens, reserved: [ ...player.reserved, e.card ] }
				}
			};
		} ),
		Match.tag( "splendor/evt/CardPurchased", ( e ) => {
			const player = state.playerData[ e.playerId ]!;
			const level = e.card.level;
			const tokens: MutableTokens = { ...state.tokens };
			const playerTokens: MutableTokens = { ...player.tokens };
			for ( const gem of ALL_GEMS ) {
				const pay = e.payment[ gem ] ?? 0;
				if ( pay > 0 ) {
					playerTokens[ gem ] -= pay;
					tokens[ gem ] += pay;
				}
			}
			const reserved = e.fromReserved
				? player.reserved.filter( c => c.id !== e.card.id )
				: player.reserved;
			const cards = e.fromReserved
				? state.cards
				: { ...state.cards, [ level ]: refillOpen( state.cards[ level ], e.card, e.replacement ) };
			const decks = e.fromReserved
				? state.decks
				: { ...state.decks, [ level ]: dropFromDeck( state.decks[ level ], e.replacement ) };
			const nobles = e.noble ? state.nobles.filter( n => n.id !== e.noble!.id ) : state.nobles;
			const playerNobles = e.noble ? [ ...player.nobles, e.noble ] : player.nobles;
			const points = player.points + e.card.points + ( e.noble ? e.noble.points : 0 );
			return {
				...state,
				tokens,
				cards,
				decks,
				nobles,
				playerData: {
					...state.playerData,
					[ e.playerId ]: {
						...player,
						tokens: playerTokens,
						cards: [ ...player.cards, e.card ],
						reserved,
						nobles: playerNobles,
						points
					}
				}
			};
		} ),
		Match.tag( "splendor/evt/WinnerDecided", ( e ) => ( { ...state, winner: e.winner } ) ),
		Match.exhaustive
	);

/** Registry slug for this game (also the DO name prefix). */
export const GAME_NAME = "splendor";
