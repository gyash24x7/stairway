import { describe, expect, test } from "bun:test";

import {
	CardPurchasedEvent,
	CardReservedEvent,
	GameDealtEvent,
	PlayerDataInitializedEvent,
	TokensPickedEvent,
	WinnerDecidedEvent
} from "@/games/splendor/shared/schema.ts";
import type {
	Card,
	Cost,
	Noble,
	SplendorState,
	Tokens
} from "@/games/splendor/shared/schema.ts";
import {
	apply,
	checkNobleVisit,
	costToString,
	DEFAULT_TOKENS,
	discountedCost,
	findNobleVisit,
	findOpenCard,
	GEMS,
	generateDecks,
	generateNobles,
	sumTokens
} from "@/games/splendor/server/utils.ts";
import { canPurchaseCard, isValidPayment } from "@/games/splendor/shared/utils.ts";
import { PlayerId } from "@/shared/swish/schema.ts";

// --- Fixtures --------------------------------------------------------------

const P1 = PlayerId.make( "p1" );

/** A full token map; every gem defaults to zero. */
const tokens = ( over: Partial<Tokens> = {} ) => ( { ...DEFAULT_TOKENS, ...over } );

/** A full cost map; every gem defaults to zero. */
const cost = ( over: Partial<Cost> = {} ) =>
	( { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, ...over } );

/** A card with sane defaults — override only what a test cares about. */
const card = ( id: string, over: Partial<Card> = {} ) => {
	const base: Card = { id, level: 1, points: 0, cost: cost(), bonus: "diamond" };
	return { ...base, ...over };
};

/** A noble whose requirement is the given (partial) cost. */
const noble = ( id: string, over: Partial<Cost> = {} ) => {
	const result: Noble = { id, points: 3, cost: cost( over ) };
	return result;
};

/** An undealt board: no tokens, no open cards, no nobles, empty decks. */
const emptyState = () => {
	const state: SplendorState = {
		tokens: tokens(),
		cards: { 1: [], 2: [], 3: [] },
		nobles: [],
		decks: { 1: [], 2: [], 3: [] },
		playerData: {}
	};
	return state;
};

/** An undealt board with `p1` already seated (the shape `onJoin` leaves behind). */
const seatedState = () => apply(
	emptyState(),
	PlayerDataInitializedEvent.make( { playerId: P1 } )
);

// ===========================================================================
describe( "splendor/utils — deck & noble generation", () => {

	test( "the three decks hold the canonical 40 / 30 / 20 cards", () => {
		const decks = generateDecks();
		expect( decks[ 1 ] ).toHaveLength( 40 );
		expect( decks[ 2 ] ).toHaveLength( 30 );
		expect( decks[ 3 ] ).toHaveLength( 20 );
	} );

	test( "every generated card id is unique and self-describing", () => {
		const decks = generateDecks();
		const all = [ ...decks[ 1 ], ...decks[ 2 ], ...decks[ 3 ] ];

		expect( new Set( all.map( c => c.id ) ).size ).toBe( all.length );
		for ( const c of all ) {
			// `L<level>-P<points>-<cost>-B<bonus initial>` — the id encodes the card.
			expect( c.id ).toBe( `L${ c.level }-P${ c.points }-${ costToString( c.cost ) }-B${ c.bonus[ 0 ] }` );
			expect( c.level ).toBe( c.id.startsWith( "L1" ) ? 1 : c.level );
		}
	} );

	test( "each deck's cards carry that deck's level", () => {
		const decks = generateDecks();
		for ( const level of [ 1, 2, 3 ] as const ) {
			expect( decks[ level ].every( c => c.level === level ) ).toBe( true );
		}
	} );

	test( "generateNobles deals playerCount + 1 distinct 3-point nobles", () => {
		for ( const playerCount of [ 2, 3, 4 ] ) {
			const nobles = generateNobles( playerCount );
			expect( nobles ).toHaveLength( playerCount + 1 );
			expect( new Set( nobles.map( n => n.id ) ).size ).toBe( nobles.length );
			expect( nobles.every( n => n.points === 3 ) ).toBe( true );
			// Every noble is either a 4/4 pair or a 3/3/3 triple.
			expect( nobles.every( n => {
				const total = GEMS.reduce( ( sum, gem ) => sum + n.cost[ gem ], 0 );
				return total === 8 || total === 9;
			} ) ).toBe( true );
		}
	} );

	test( "the noble pool is exhausted at 20, so a huge table gets no more", () => {
		expect( generateNobles( 100 ) ).toHaveLength( 20 );
	} );

	test( "costToString renders a stable gem-initial encoding", () => {
		expect( costToString( cost( { diamond: 4, onyx: 4 } ) ) ).toBe( "d4-s0-e0-r0-o4" );
	} );
} );

// ===========================================================================
describe( "splendor/utils — pure helpers", () => {

	test( "sumTokens totals a partial token map, ignoring absent gems", () => {
		expect( sumTokens( {} ) ).toBe( 0 );
		expect( sumTokens( { diamond: 2, gold: 1 } ) ).toBe( 3 );
		expect( sumTokens( tokens( { ruby: 5 } ) ) ).toBe( 5 );
	} );

	test( "findOpenCard searches every level and returns undefined when absent", () => {
		const cards = { 1: [ card( "a" ) ], 2: [], 3: [ card( "c", { level: 3 } ) ] };
		expect( findOpenCard( "a", cards )?.id ).toBe( "a" );
		expect( findOpenCard( "c", cards )?.id ).toBe( "c" );
		expect( findOpenCard( "missing", cards ) ).toBeUndefined();
	} );

	test( "discountedCost subtracts one per owned bonus card and floors at zero", () => {
		const target = card( "t", { cost: cost( { diamond: 3, onyx: 1 } ) } );
		const owned = [ card( "d1" ), card( "d2" ), card( "d3" ), card( "d4" ) ];

		// Four diamond bonuses against a cost of three → floored at 0, not -1.
		expect( discountedCost( target, owned ) ).toEqual( cost( { onyx: 1 } ) );
		expect( discountedCost( target, [] ) ).toEqual( cost( { diamond: 3, onyx: 1 } ) );
	} );

	test( "findNobleVisit returns the first qualifying noble, else null", () => {
		const nobles = [ noble( "n1", { diamond: 3 } ), noble( "n2", { onyx: 1 } ) ];
		const diamonds = [ card( "d1" ), card( "d2" ), card( "d3" ) ];

		expect( findNobleVisit( diamonds, nobles )?.id ).toBe( "n1" );
		expect( findNobleVisit( [ card( "o1", { bonus: "onyx" } ) ], nobles )?.id ).toBe( "n2" );
		expect( findNobleVisit( [], nobles ) ).toBeNull();
	} );

	test( "checkNobleVisit answers the same question off a PlayerData", () => {
		const player = {
			tokens: tokens(),
			cards: [ card( "d1" ), card( "d2" ), card( "d3" ) ],
			nobles: [],
			reserved: [],
			points: 0
		};

		expect( checkNobleVisit( player, [ noble( "n1", { diamond: 3 } ) ] ) ).toBe( "n1" );
		expect( checkNobleVisit( player, [ noble( "n1", { onyx: 1 } ) ] ) ).toBeUndefined();
	} );
} );

// ===========================================================================
describe( "splendor/utils — client affordability helpers", () => {

	test( "canPurchaseCard accepts an exact hand and a discounted one", () => {
		const target = card( "t", { cost: cost( { diamond: 2, onyx: 1 } ) } );

		expect( canPurchaseCard( target, tokens( { diamond: 2, onyx: 1 } ), [] ) ).toBe( true );
		expect( canPurchaseCard( target, tokens( { onyx: 1 } ), [ card( "d1" ), card( "d2" ) ] ) )
			.toBe( true );
		expect( canPurchaseCard( target, tokens( { diamond: 1 } ), [] ) ).toBe( false );
	} );

	test( "canPurchaseCard covers the shortfall with gold", () => {
		const target = card( "t", { cost: cost( { diamond: 2, onyx: 1 } ) } );

		expect( canPurchaseCard( target, tokens( { diamond: 1, gold: 2 } ), [] ) ).toBe( true );
		expect( canPurchaseCard( target, tokens( { diamond: 1, gold: 1 } ), [] ) ).toBe( false );
	} );

	test( "isValidPayment demands exact change — no over- or under-payment", () => {
		const target = card( "t", { cost: cost( { diamond: 2, onyx: 1 } ) } );

		expect( isValidPayment( target, { diamond: 2, onyx: 1 }, [] ) ).toBe( true );
		// Gold makes up exactly the shortfall...
		expect( isValidPayment( target, { diamond: 1, onyx: 1, gold: 1 }, [] ) ).toBe( true );
		// ...but never more than it.
		expect( isValidPayment( target, { diamond: 2, onyx: 1, gold: 1 }, [] ) ).toBe( false );
		expect( isValidPayment( target, { diamond: 3, onyx: 1 }, [] ) ).toBe( false );
		expect( isValidPayment( target, { diamond: 1, onyx: 1 }, [] ) ).toBe( false );
	} );

	test( "isValidPayment applies discounts before demanding change", () => {
		const target = card( "t", { cost: cost( { diamond: 2, onyx: 1 } ) } );
		const owned = [ card( "d1" ), card( "d2" ) ];

		expect( isValidPayment( target, { onyx: 1 }, owned ) ).toBe( true );
		expect( isValidPayment( target, { diamond: 1, onyx: 1 }, owned ) ).toBe( false );
	} );
} );

// ===========================================================================
describe( "splendor/utils — apply (the pure reducer)", () => {

	test( "PlayerDataInitialized seeds an empty slice per player", () => {
		const next = seatedState();
		expect( next.playerData[ P1 ] ).toEqual( {
			tokens: tokens(),
			cards: [],
			nobles: [],
			reserved: [],
			points: 0
		} );
	} );

	test( "apply never mutates the state it is handed", () => {
		const state = emptyState();
		const next = apply( state, PlayerDataInitializedEvent.make( { playerId: P1 } ) );

		expect( next ).not.toBe( state );
		expect( Object.keys( state.playerData ) ).toHaveLength( 0 );
	} );

	test( "GameDealt replaces the whole board in one event", () => {
		const dealt = apply( seatedState(), GameDealtEvent.make( {
			tokens: tokens( { diamond: 5, gold: 5 } ),
			nobles: [ noble( "n1" ) ],
			cards: { 1: [ card( "a" ) ], 2: [], 3: [] },
			decks: { 1: [ card( "b" ) ], 2: [], 3: [] }
		} ) );

		expect( dealt.tokens ).toEqual( tokens( { diamond: 5, gold: 5 } ) );
		expect( dealt.nobles.map( n => n.id ) ).toEqual( [ "n1" ] );
		expect( dealt.cards[ 1 ].map( c => c.id ) ).toEqual( [ "a" ] );
		expect( dealt.decks[ 1 ].map( c => c.id ) ).toEqual( [ "b" ] );
		// The deal does not touch the already-seeded player slices.
		expect( dealt.playerData[ P1 ]!.points ).toBe( 0 );
	} );

	test( "TokensPicked moves tokens off the board and returns the overflow", () => {
		const board = apply( seatedState(), GameDealtEvent.make( {
			tokens: tokens( { diamond: 5, sapphire: 5, emerald: 5 } ),
			nobles: [],
			cards: { 1: [], 2: [], 3: [] },
			decks: { 1: [], 2: [], 3: [] }
		} ) );

		const picked = apply( board, TokensPickedEvent.make( {
			playerId: P1,
			tokens: { diamond: 1, sapphire: 1, emerald: 1 },
			returned: { diamond: 1 }
		} ) );

		expect( picked.playerData[ P1 ]!.tokens ).toEqual( tokens( { sapphire: 1, emerald: 1 } ) );
		expect( picked.tokens ).toEqual( tokens( { diamond: 5, sapphire: 4, emerald: 4 } ) );
	} );

	test( "CardReserved takes the card, refills the slot, and pays out a gold", () => {
		const board = apply( seatedState(), GameDealtEvent.make( {
			tokens: tokens( { gold: 5, diamond: 5 } ),
			nobles: [],
			cards: { 1: [ card( "open" ) ], 2: [], 3: [] },
			decks: { 1: [ card( "next" ), card( "later" ) ], 2: [], 3: [] }
		} ) );

		// The player must already hold the token they hand back — `validate` is what
		// guarantees that upstream, so the fixture funds them first.
		const funded = apply( board, TokensPickedEvent.make( {
			playerId: P1,
			tokens: { diamond: 1 }
		} ) );

		const reserved = apply( funded, CardReservedEvent.make( {
			playerId: P1,
			card: card( "open" ),
			replacement: card( "next" ),
			withGold: true,
			returnedToken: "diamond"
		} ) );

		expect( reserved.playerData[ P1 ]!.reserved.map( c => c.id ) ).toEqual( [ "open" ] );
		expect( reserved.cards[ 1 ].map( c => c.id ) ).toEqual( [ "next" ] );
		expect( reserved.decks[ 1 ].map( c => c.id ) ).toEqual( [ "later" ] );
		expect( reserved.playerData[ P1 ]!.tokens ).toEqual( tokens( { gold: 1 } ) );
		expect( reserved.tokens ).toEqual( tokens( { gold: 4, diamond: 5 } ) );
	} );

	test( "CardReserved with an exhausted deck empties the slot instead of refilling", () => {
		const board = apply( seatedState(), GameDealtEvent.make( {
			tokens: tokens(),
			nobles: [],
			cards: { 1: [ card( "open" ), card( "other" ) ], 2: [], 3: [] },
			decks: { 1: [], 2: [], 3: [] }
		} ) );

		const reserved = apply( board, CardReservedEvent.make( {
			playerId: P1,
			card: card( "open" ),
			replacement: null,
			withGold: false
		} ) );

		expect( reserved.cards[ 1 ].map( c => c.id ) ).toEqual( [ "other" ] );
	} );

	test( "CardPurchased pays the board, banks the card, and refills the slot", () => {
		const board = apply( seatedState(), GameDealtEvent.make( {
			tokens: tokens( { diamond: 3 } ),
			nobles: [],
			cards: { 1: [ card( "open", { points: 1 } ) ], 2: [], 3: [] },
			decks: { 1: [ card( "next" ) ], 2: [], 3: [] }
		} ) );

		const funded = apply( board, TokensPickedEvent.make( {
			playerId: P1,
			tokens: { diamond: 2 }
		} ) );

		const bought = apply( funded, CardPurchasedEvent.make( {
			playerId: P1,
			card: card( "open", { points: 1 } ),
			fromReserved: false,
			replacement: card( "next" ),
			payment: { diamond: 2 },
			noble: null
		} ) );

		expect( bought.playerData[ P1 ]!.cards.map( c => c.id ) ).toEqual( [ "open" ] );
		expect( bought.playerData[ P1 ]!.points ).toBe( 1 );
		expect( bought.playerData[ P1 ]!.tokens.diamond ).toBe( 0 );
		expect( bought.tokens.diamond ).toBe( 3 );
		expect( bought.cards[ 1 ].map( c => c.id ) ).toEqual( [ "next" ] );
		expect( bought.decks[ 1 ] ).toHaveLength( 0 );
	} );

	test( "CardPurchased from reserve leaves the open rows alone", () => {
		const board = apply( seatedState(), GameDealtEvent.make( {
			tokens: tokens(),
			nobles: [],
			cards: { 1: [ card( "open" ) ], 2: [], 3: [] },
			decks: { 1: [ card( "next" ) ], 2: [], 3: [] }
		} ) );

		const held = apply( board, CardReservedEvent.make( {
			playerId: P1,
			card: card( "open" ),
			replacement: card( "next" ),
			withGold: false
		} ) );

		const bought = apply( held, CardPurchasedEvent.make( {
			playerId: P1,
			card: card( "open" ),
			fromReserved: true,
			replacement: null,
			payment: {},
			noble: null
		} ) );

		expect( bought.playerData[ P1 ]!.reserved ).toHaveLength( 0 );
		expect( bought.playerData[ P1 ]!.cards.map( c => c.id ) ).toEqual( [ "open" ] );
		expect( bought.cards[ 1 ].map( c => c.id ) ).toEqual( [ "next" ] );
	} );

	test( "CardPurchased with a noble moves the noble and scores both", () => {
		const visiting = noble( "n1", { diamond: 1 } );
		const board = apply( seatedState(), GameDealtEvent.make( {
			tokens: tokens(),
			nobles: [ visiting, noble( "n2", { onyx: 4 } ) ],
			cards: { 1: [ card( "open", { points: 2 } ) ], 2: [], 3: [] },
			decks: { 1: [], 2: [], 3: [] }
		} ) );

		const bought = apply( board, CardPurchasedEvent.make( {
			playerId: P1,
			card: card( "open", { points: 2 } ),
			fromReserved: false,
			replacement: null,
			payment: {},
			noble: visiting
		} ) );

		expect( bought.nobles.map( n => n.id ) ).toEqual( [ "n2" ] );
		expect( bought.playerData[ P1 ]!.nobles.map( n => n.id ) ).toEqual( [ "n1" ] );
		// 2 for the card + 3 for the noble.
		expect( bought.playerData[ P1 ]!.points ).toBe( 5 );
	} );

	test( "WinnerDecided records the winner on the board", () => {
		const decided = apply( seatedState(), WinnerDecidedEvent.make( { winner: P1 } ) );
		expect( decided.winner ).toBe( P1 );
	} );
} );
