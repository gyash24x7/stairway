import { describe, expect, test } from "bun:test";

import {
	costToString,
	generateDecks,
	generateNobles,
	standingsFor
} from "@/games/splendor/server/utils.ts";
import {
	discountedCost,
	hasLegalMove,
	isValidPayment,
	paymentFor,
	qualifyingNobles,
	sumTokens
} from "@/games/splendor/shared/utils.ts";
import { makeRng } from "@/shared/utils/rng.ts";

import type { Card, Cost, PlayerData, Tokens } from "@/games/splendor/shared/schema.ts";
import type { PlayerId } from "@/swish/shared/schema.ts";

const player = ( id: string ) => id as PlayerId;

const cost = ( over: Partial<Cost> = {} ): Cost =>
	( { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, ...over } );

const tokens = ( over: Partial<Tokens> = {} ): Tokens =>
	( { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 0, ...over } );

const card = ( over: Partial<Card> = {} ): Card => ( {
	id: "card",
	level: 1,
	points: 0,
	cost: cost(),
	bonus: "diamond",
	...over
} );

const seat = ( over: Partial<PlayerData> = {} ): PlayerData => ( {
	tokens: tokens(),
	cards: [],
	nobles: [],
	reserved: [],
	points: 0,
	...over
} );


describe( "the development decks", () => {
	const decks = generateDecks( makeRng( 1 ).next );

	test( "hold the printed 40 / 30 / 20 split", () => {
		expect( decks[ 1 ] ).toHaveLength( 40 );
		expect( decks[ 2 ] ).toHaveLength( 30 );
		expect( decks[ 3 ] ).toHaveLength( 20 );
	} );

	test( "give every card an id of its own", () => {
		const ids = [ ...decks[ 1 ], ...decks[ 2 ], ...decks[ 3 ] ].map( c => c.id );
		expect( new Set( ids ).size ).toBe( ids.length );
	} );

	test( "spread the bonuses evenly across the five gems", () => {
		for ( const [ level, perGem ] of [ [ 1, 8 ], [ 2, 6 ], [ 3, 4 ] ] as const ) {
			const counts = new Map<string, number>();
			for ( const c of decks[ level ] ) {
				counts.set( c.bonus, ( counts.get( c.bonus ) ?? 0 ) + 1 );
			}

			expect( [ ...counts.values() ] ).toEqual( [ perGem, perGem, perGem, perGem, perGem ] );
		}
	} );

	test( "carry the prestige each level is printed with", () => {
		expect( new Set( decks[ 1 ].map( c => c.points ) ) ).toEqual( new Set( [ 0, 1 ] ) );
		expect( new Set( decks[ 2 ].map( c => c.points ) ) ).toEqual( new Set( [ 1, 2, 3 ] ) );
		expect( new Set( decks[ 3 ].map( c => c.points ) ) ).toEqual( new Set( [ 3, 4, 5 ] ) );
	} );

	test( "come out the same for the same seed, and differently for another", () => {
		const same = generateDecks( makeRng( 1 ).next );
		const other = generateDecks( makeRng( 2 ).next );

		expect( same[ 1 ].map( c => c.id ) ).toEqual( decks[ 1 ].map( c => c.id ) );
		expect( other[ 1 ].map( c => c.id ) ).not.toEqual( decks[ 1 ].map( c => c.id ) );
	} );
} );


describe( "the nobles", () => {
	test( "come one to a seat, plus one", () => {
		for ( const playerCount of [ 2, 3, 4 ] ) {
			expect( generateNobles( playerCount, makeRng( 7 ).next ) ).toHaveLength( playerCount + 1 );
		}
	} );

	test( "are distinct and worth three apiece", () => {
		const nobles = generateNobles( 4, makeRng( 7 ).next );

		expect( new Set( nobles.map( n => n.id ) ).size ).toBe( nobles.length );
		expect( nobles.every( n => n.points === 3 ) ).toBe( true );
	} );

	test( "ask for two fours or three threes and nothing else", () => {
		const nobles = generateNobles( 4, makeRng( 11 ).next );

		for ( const noble of nobles ) {
			const asked = Object.values( noble.cost ).filter( n => n > 0 );
			expect( [ [ 4, 4 ], [ 3, 3, 3 ] ] ).toContainEqual( asked );
		}
	} );

	test( "come to whoever's bought cards satisfy them, all of them", () => {
		const owned = [
			card( { id: "a", bonus: "diamond" } ),
			card( { id: "b", bonus: "diamond" } ),
			card( { id: "c", bonus: "diamond" } ),
			card( { id: "d", bonus: "sapphire" } ),
			card( { id: "e", bonus: "sapphire" } ),
			card( { id: "f", bonus: "sapphire" } ),
			card( { id: "g", bonus: "emerald" } ),
			card( { id: "h", bonus: "emerald" } ),
			card( { id: "i", bonus: "emerald" } )
		];

		const reachable = {
			id: "n1",
			points: 3,
			cost: cost( { diamond: 3, sapphire: 3, emerald: 3 } )
		};

		const out = { id: "n2", points: 3, cost: cost( { ruby: 4, onyx: 4 } ) };

		expect( qualifyingNobles( owned, [ out, reachable ] ) ).toEqual( [ reachable ] );
		expect( qualifyingNobles( owned.slice( 0, 8 ), [ out, reachable ] ) ).toEqual( [] );
	} );

	test( "name themselves after the price they ask", () => {
		expect( costToString( cost( { diamond: 4, onyx: 4 } ) ) ).toBe( "d4-s0-e0-r0-o4" );
	} );
} );


describe( "pricing a card", () => {
	const target = card( { cost: cost( { diamond: 3, sapphire: 2 } ) } );

	test( "discounts it by the bonuses already bought, never below zero", () => {
		const owned = [
			card( { id: "1", bonus: "diamond" } ),
			card( { id: "2", bonus: "sapphire" } ),
			card( { id: "3", bonus: "sapphire" } ),
			card( { id: "4", bonus: "sapphire" } )
		];

		expect( discountedCost( target, owned ) ).toEqual( cost( { diamond: 2 } ) );
	} );

	test( "spends gems first and gold only for the shortfall", () => {
		expect( paymentFor( target, tokens( { diamond: 1, gold: 5 } ), [] ) )
			.toEqual( { diamond: 1, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 4 } );
	} );

	test( "refuses a card the gold cannot bridge", () => {
		expect( paymentFor( target, tokens( { diamond: 1, gold: 3 } ), [] ) ).toBeUndefined();
	} );

	test( "accepts a payment that settles the cost exactly", () => {
		expect( isValidPayment( target, { diamond: 3, sapphire: 2 }, [] ) ).toBe( true );
		expect( isValidPayment( target, { diamond: 1, gold: 4 }, [] ) ).toBe( true );
	} );

	test( "rejects an overpayment, in gems or in gold", () => {
		expect( isValidPayment( target, { diamond: 4, sapphire: 2 }, [] ) ).toBe( false );
		expect( isValidPayment( target, { diamond: 3, sapphire: 2, gold: 1 }, [] ) ).toBe( false );
	} );

	test( "rejects a payment that leaves the cost short", () => {
		expect( isValidPayment( target, { diamond: 3, sapphire: 1 }, [] ) ).toBe( false );
	} );

	test( "totals a partial token map, absences and all", () => {
		expect( sumTokens( { diamond: 2, gold: 1 } ) ).toBe( 3 );
		expect( sumTokens( {} ) ).toBe( 0 );
	} );
} );


describe( "the final standings", () => {
	const [ a, b, c ] = [ player( "a" ), player( "b" ), player( "c" ) ];

	test( "rank by prestige, most first", () => {
		const { ranking, winner } = standingsFor( [ a, b ], {
			[ a ]: seat( { points: 12 } ),
			[ b ]: seat( { points: 15 } )
		} );

		expect( ranking.map( r => r.playerId ) ).toEqual( [ b, a ] );
		expect( ranking.map( r => r.score ) ).toEqual( [ 15, 12 ] );
		expect( winner ).toBe( b );
	} );

	test( "break a prestige tie in favour of fewer development cards", () => {
		const { ranking, winner } = standingsFor( [ a, b ], {
			[ a ]: seat( { points: 15, cards: [ card(), card(), card() ] } ),
			[ b ]: seat( { points: 15, cards: [ card(), card() ] } )
		} );

		expect( ranking.map( r => r.playerId ) ).toEqual( [ b, a ] );
		expect( winner ).toBe( b );
	} );

	test( "name nobody when the top two are level on both keys", () => {
		const { ranking, winner } = standingsFor( [ a, b ], {
			[ a ]: seat( { points: 15, cards: [ card() ] } ),
			[ b ]: seat( { points: 15, cards: [ card() ] } )
		} );

		expect( ranking.map( r => r.rank ) ).toEqual( [ 1, 1 ] );
		expect( winner ).toBeUndefined();
	} );

	test( "let tied seats share a place and the next one skip it", () => {
		const { ranking } = standingsFor( [ a, b, c ], {
			[ a ]: seat( { points: 15 } ),
			[ b ]: seat( { points: 15 } ),
			[ c ]: seat( { points: 3 } )
		} );

		expect( ranking.map( r => r.rank ) ).toEqual( [ 1, 1, 3 ] );
	} );
} );


describe( "having a move to make", () => {
	const bank = ( over: Partial<Tokens> = {} ) => ( { tokens: tokens( over ), cards: board() } );
	const board = ( over: Partial<Record<1 | 2 | 3, Array<Card>>> = {} ) =>
		( { 1: [], 2: [], 3: [], ...over } );

	/** Three cards nothing could pay for out of an empty purse. */
	const dear = [ 1, 2, 3 ].map( n =>
		card( { id: `dear-${ n }`, cost: cost( { onyx: 7 } ) } ) );

	test( "a gem left in the bank is a move, whatever else is true", () => {
		const table = { tokens: tokens( { diamond: 1 } ), cards: board() };
		expect( hasLegalMove( table, seat( { reserved: dear } ) ) ).toBe( true );
	} );

	test( "gold alone is not — it is only ever taken with a reservation", () => {
		const table = { tokens: tokens( { gold: 5 } ), cards: board() };
		expect( hasLegalMove( table, seat( { reserved: dear } ) ) ).toBe( false );
	} );

	test( "an empty bank still leaves a card to reserve", () => {
		const table = { ...bank(), cards: board( { 1: [ card( { cost: cost( { onyx: 7 } ) } ) ] } ) };
		expect( hasLegalMove( table, seat() ) ).toBe( true );
	} );

	test( "reserving needs something on the board to take", () => {
		expect( hasLegalMove( bank(), seat() ) ).toBe( false );
	} );

	test( "reserving needs room under the three-card limit", () => {
		const table = { ...bank(), cards: board( { 1: [ card( { cost: cost( { onyx: 7 } ) } ) ] } ) };
		expect( hasLegalMove( table, seat( { reserved: dear } ) ) ).toBe( false );
	} );

	test( "a card on the board the seat can pay for is a move", () => {
		const table = { ...bank(), cards: board( { 1: [ card( { cost: cost( { ruby: 2 } ) } ) ] } ) };
		const player = seat( { reserved: dear, tokens: tokens( { ruby: 2 } ) } );

		expect( hasLegalMove( table, player ) ).toBe( true );
	} );

	test( "so is one the seat is already holding", () => {
		const held = card( { id: "held", cost: cost( { ruby: 2 } ) } );
		const player = seat( {
			reserved: [ ...dear.slice( 0, 2 ), held ],
			tokens: tokens( { ruby: 2 } )
		} );

		expect( hasLegalMove( bank(), player ) ).toBe( true );
	} );

	test( "counts the discounts the seat's bought cards give it", () => {
		const held = card( { id: "held", cost: cost( { diamond: 3 } ) } );
		const bought = [ 1, 2, 3 ].map( n => card( { id: `b${ n }`, bonus: "diamond" } ) );

		// Three diamond bonuses cover the price outright, with no tokens at all.
		expect( hasLegalMove( bank(), seat( { reserved: [ held ], cards: bought } ) ) ).toBe( true );
		expect( hasLegalMove( bank(), seat( { reserved: [ held ] } ) ) ).toBe( false );
	} );

	test( "counts gold toward the shortfall", () => {
		const held = card( { id: "held", cost: cost( { diamond: 3 } ) } );

		expect( hasLegalMove( bank(), seat( { reserved: [ held ], tokens: tokens( { gold: 3 } ) } ) ) )
			.toBe( true );
		expect( hasLegalMove( bank(), seat( { reserved: [ held ], tokens: tokens( { gold: 2 } ) } ) ) )
			.toBe( false );
	} );
} );
