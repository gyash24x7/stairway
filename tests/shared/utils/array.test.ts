import { describe, expect, it } from "bun:test";

import { chunk, objectKeys, remove, shuffle } from "@/shared/utils/array.ts";
import { mulberry32 } from "@/shared/utils/rng.ts";

describe( "shuffle", () => {
	it( "returns a new array, leaving the input untouched", () => {
		const input = [ 1, 2, 3, 4 ];
		const out = shuffle( input );
		expect( out ).not.toBe( input );
		expect( input ).toEqual( [ 1, 2, 3, 4 ] );
	} );

	it( "preserves all elements (is a permutation)", () => {
		const input = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ];
		const out = shuffle( input );
		expect( [ ...out ].sort( ( a, b ) => a - b ) ).toEqual( input );
	} );

	it( "is deterministic and reproducible given a seeded rng", () => {
		const input = [ "a", "b", "c", "d", "e", "f" ];
		expect( shuffle( input, mulberry32( 123 ) ) ).toEqual( shuffle( input, mulberry32( 123 ) ) );
	} );

	it( "handles empty and single-element arrays", () => {
		expect( shuffle( [] ) ).toEqual( [] );
		expect( shuffle( [ 99 ] ) ).toEqual( [ 99 ] );
	} );
} );

describe( "chunk", () => {
	it( "splits into evenly sized chunks", () => {
		expect( chunk( [ 1, 2, 3, 4 ], 2 ) ).toEqual( [ [ 1, 2 ], [ 3, 4 ] ] );
	} );

	it( "puts the remainder in a final smaller chunk", () => {
		expect( chunk( [ 1, 2, 3, 4, 5 ], 2 ) ).toEqual( [ [ 1, 2 ], [ 3, 4 ], [ 5 ] ] );
	} );

	it( "returns a single chunk when size exceeds length", () => {
		expect( chunk( [ 1, 2 ], 5 ) ).toEqual( [ [ 1, 2 ] ] );
	} );

	it( "returns an empty array for an empty input", () => {
		expect( chunk( [], 3 ) ).toEqual( [] );
	} );
} );

describe( "remove", () => {
	it( "removes elements matching the predicate", () => {
		expect( remove( ( n: number ) => n % 2 === 0, [ 1, 2, 3, 4, 5 ] ) ).toEqual( [ 1, 3, 5 ] );
	} );

	it( "returns a new array, leaving the input untouched", () => {
		const input = [ 1, 2, 3 ];
		const out = remove( () => false, input );
		expect( out ).not.toBe( input );
		expect( input ).toEqual( [ 1, 2, 3 ] );
	} );

	it( "removes everything when the predicate always matches", () => {
		expect( remove( () => true, [ 1, 2, 3 ] ) ).toEqual( [] );
	} );

	it( "keeps everything when the predicate never matches", () => {
		expect( remove( () => false, [ 1, 2, 3 ] ) ).toEqual( [ 1, 2, 3 ] );
	} );
} );

describe( "objectKeys", () => {
	it( "returns the object's own enumerable keys", () => {
		expect( objectKeys( { a: 1, b: 2, c: 3 } ) ).toEqual( [ "a", "b", "c" ] );
	} );

	it( "returns an empty array for an empty object", () => {
		expect( objectKeys( {} ) ).toEqual( [] );
	} );
} );
