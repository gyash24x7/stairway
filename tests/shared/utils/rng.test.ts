import { describe, expect, it } from "bun:test";

import { hashSeed, makeRng, mulberry32 } from "@/shared/utils/rng.ts";

describe( "hashSeed", () => {
	it( "is deterministic for the same parts", () => {
		expect( hashSeed( "game", 1, "decider" ) ).toBe( hashSeed( "game", 1, "decider" ) );
	} );

	it( "returns an unsigned 32-bit integer", () => {
		const h = hashSeed( "anything", 42 );
		expect( Number.isInteger( h ) ).toBe( true );
		expect( h ).toBeGreaterThanOrEqual( 0 );
		expect( h ).toBeLessThanOrEqual( 0xffffffff );
	} );

	it( "produces distinct streams for distinct part tuples", () => {
		expect( hashSeed( "seed", 1 ) ).not.toBe( hashSeed( "seed", 2 ) );
		expect( hashSeed( "a", "b" ) ).not.toBe( hashSeed( "b", "a" ) );
	} );

	it( "treats parts joined by '|' — order and boundaries matter", () => {
		// ["a","b"] -> "a|b" ; ["ab"] -> "ab" ; different hashes expected.
		expect( hashSeed( "a", "b" ) ).not.toBe( hashSeed( "ab" ) );
	} );

	it( "handles an empty argument list", () => {
		const h = hashSeed();
		expect( Number.isInteger( h ) ).toBe( true );
		expect( h ).toBeGreaterThanOrEqual( 0 );
	} );
} );

describe( "mulberry32", () => {
	it( "yields the same stream for the same seed", () => {
		const a = mulberry32( 12345 );
		const b = mulberry32( 12345 );
		const seqA = Array.from( { length: 5 }, () => a() );
		const seqB = Array.from( { length: 5 }, () => b() );
		expect( seqA ).toEqual( seqB );
	} );

	it( "yields floats in [0, 1)", () => {
		const rand = mulberry32( 99 );
		for ( let i = 0; i < 1000; i++ ) {
			const v = rand();
			expect( v ).toBeGreaterThanOrEqual( 0 );
			expect( v ).toBeLessThan( 1 );
		}
	} );

	it( "advances — consecutive draws differ", () => {
		const rand = mulberry32( 7 );
		expect( rand() ).not.toBe( rand() );
	} );

	it( "produces different streams for different seeds", () => {
		const a = mulberry32( 1 )();
		const b = mulberry32( 2 )();
		expect( a ).not.toBe( b );
	} );

	it( "normalizes the seed with >>> 0 (0 and 2^32 are equivalent)", () => {
		expect( mulberry32( 0 )() ).toBe( mulberry32( 0x100000000 )() );
	} );
} );

describe( "makeRng", () => {
	it( "next() is deterministic from the seed", () => {
		const seq1 = Array.from( { length: 4 }, () => makeRng( 555 ).next() );
		// each makeRng(555) is a fresh stream, so first draws all match
		expect( new Set( seq1 ).size ).toBe( 1 );
	} );

	it( "int(max) returns an integer in [0, max)", () => {
		const rng = makeRng( 2024 );
		for ( let i = 0; i < 1000; i++ ) {
			const n = rng.int( 6 );
			expect( Number.isInteger( n ) ).toBe( true );
			expect( n ).toBeGreaterThanOrEqual( 0 );
			expect( n ).toBeLessThan( 6 );
		}
	} );

	it( "shuffle returns a new array and preserves elements (permutation)", () => {
		const input = [ 1, 2, 3, 4, 5, 6, 7, 8 ];
		const rng = makeRng( 42 );
		const out = rng.shuffle( input );
		expect( out ).not.toBe( input );
		expect( input ).toEqual( [ 1, 2, 3, 4, 5, 6, 7, 8 ] ); // input untouched
		expect( [ ...out ].sort( ( a, b ) => a - b ) ).toEqual( input );
	} );

	it( "shuffle is reproducible for the same seed", () => {
		const input = [ "a", "b", "c", "d", "e" ];
		expect( makeRng( 1 ).shuffle( input ) ).toEqual( makeRng( 1 ).shuffle( input ) );
	} );

	it( "shuffle differs across seeds (for a large enough array)", () => {
		const input = Array.from( { length: 20 }, ( _, i ) => i );
		expect( makeRng( 1 ).shuffle( input ) ).not.toEqual( makeRng( 2 ).shuffle( input ) );
	} );

	it( "shuffle handles empty and single-element arrays", () => {
		expect( makeRng( 3 ).shuffle( [] ) ).toEqual( [] );
		expect( makeRng( 3 ).shuffle( [ 42 ] ) ).toEqual( [ 42 ] );
	} );
} );
