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
} from "@/games/splendor/shared/schema";
import { shuffle } from "@/shared/utils/array";
import * as Match from "effect/Match";
import { castDraft, produce } from "immer";

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

export function checkNobleVisit(
	player: PlayerData,
	nobles: ReadonlyArray<Noble>
): string | undefined {
	const bonuses = getPlayerBonuses( player );

	for ( const noble of nobles ) {
		const qualifies = GEMS.every( gem => bonuses[ gem ] >= noble.cost[ gem ] );
		if ( qualifies ) {
			return noble.id;
		}
	}

	return undefined;
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

/** Remove one card by id from a level's deck in place (immer draft array). */
const dropDeckCard = ( deck: Card[], card: Card | null ): void => {
	if ( card === null ) {
		return;
	}
	const idx = deck.findIndex( c => c.id === card.id );
	if ( idx >= 0 ) {
		deck.splice( idx, 1 );
	}
};

/** Replace an open slot (by removed card id) with `replacement`, or drop it, in place. */
const refillOpenCard = ( open: Card[], removed: Card, replacement: Card | null ): void => {
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

// --- Reducer ---------------------------------------------------------------

/** Pure reducer — the ONLY place `state` changes. Mutations are on an immer draft. */
export const apply = ( state: SplendorState, event: SplendorEvent ): SplendorState =>
	produce( state, ( draft ) => {
		Match.value( event ).pipe(
			Match.tag( "splendor/evt/PlayerDataInitialized", ( e ) => {
				draft.playerData[ e.playerId ] = {
					tokens: { ...DEFAULT_TOKENS },
					cards: [],
					nobles: [],
					reserved: [],
					points: 0
				};
			} ),
			Match.tag( "splendor/evt/GameDealt", ( e ) => {
				draft.tokens = castDraft( e.tokens );
				draft.nobles = castDraft( e.nobles );
				draft.cards = castDraft( e.cards );
				draft.decks = castDraft( e.decks );
			} ),
			Match.tag( "splendor/evt/TokensPicked", ( e ) => {
				const player = draft.playerData[ e.playerId ]!;
				for ( const gem of ALL_GEMS ) {
					const take = e.tokens[ gem ] ?? 0;
					if ( take > 0 ) {
						player.tokens[ gem ] += take;
						draft.tokens[ gem ] -= take;
					}
				}
				if ( e.returned ) {
					for ( const gem of ALL_GEMS ) {
						const ret = e.returned[ gem ] ?? 0;
						if ( ret > 0 ) {
							player.tokens[ gem ] -= ret;
							draft.tokens[ gem ] += ret;
						}
					}
				}
			} ),
			Match.tag( "splendor/evt/CardReserved", ( e ) => {
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
			Match.tag( "splendor/evt/CardPurchased", ( e ) => {
				const player = draft.playerData[ e.playerId ]!;
				const level = e.card.level;
				for ( const gem of ALL_GEMS ) {
					const pay = e.payment[ gem ] ?? 0;
					if ( pay > 0 ) {
						player.tokens[ gem ] -= pay;
						draft.tokens[ gem ] += pay;
					}
				}
				if ( e.fromReserved ) {
					const idx = player.reserved.findIndex( c => c.id === e.card.id );
					if ( idx >= 0 ) {
						player.reserved.splice( idx, 1 );
					}
				} else {
					refillOpenCard( draft.cards[ level ], castDraft( e.card ), castDraft( e.replacement ) );
					dropDeckCard( draft.decks[ level ], castDraft( e.replacement ) );
				}
				if ( e.noble ) {
					const nidx = draft.nobles.findIndex( n => n.id === e.noble!.id );
					if ( nidx >= 0 ) {
						draft.nobles.splice( nidx, 1 );
					}
					player.nobles.push( castDraft( e.noble ) );
					player.points += e.noble.points;
				}
				player.cards.push( castDraft( e.card ) );
				player.points += e.card.points;
			} ),
			Match.tag( "splendor/evt/WinnerDecided", ( e ) => { draft.winner = e.winner; } ),
			Match.exhaustive
		);
	} );

/** Registry slug for this game (also the DO name prefix). */
export const GAME_NAME = "splendor";
