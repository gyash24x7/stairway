import { describe, expect, it } from "vitest";
import { chunk, remove, shuffle } from "../src/array.ts";

describe( "array utils", () => {
	it( "shuffle returns a new array with same elements in different order", () => {
		const arr = [ 1, 2, 3 ];
		const result = shuffle( arr );
		expect( result.sort() ).toEqual( arr.sort() );
	} );

	it( "shuffle returns empty array when input is empty", () => {
		expect( shuffle( [] ) ).toEqual( [] );
	} );

	it( "chunk splits array into correct sized chunks", () => {
		expect( chunk( [ 1, 2, 3, 4, 5 ], 2 ) ).toEqual( [ [ 1, 2 ], [ 3, 4 ], [ 5 ] ] );
		expect( chunk( [ 1, 2, 3, 4 ], 2 ) ).toEqual( [ [ 1, 2 ], [ 3, 4 ] ] );
		expect( chunk( [ 1, 2, 3 ], 1 ) ).toEqual( [ [ 1 ], [ 2 ], [ 3 ] ] );
	} );

	it( "chunk returns empty array when input is empty", () => {
		expect( chunk( [], 3 ) ).toEqual( [] );
	} );

	it( "remove filters elements based on predicate", () => {
		expect( remove( x => x % 2 === 0, [ 1, 2, 3, 4 ] ) ).toEqual( [ 1, 3 ] );
		expect( remove( x => x > 10, [ 1, 2, 3 ] ) ).toEqual( [ 1, 2, 3 ] );
		expect( remove( _ => true, [ 1, 2, 3 ] ) ).toEqual( [] );
	} );

	it( "remove returns empty array when input is empty", () => {
		expect( remove( () => true, [] ) ).toEqual( [] );
	} );
} );
