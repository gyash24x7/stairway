import { describe, expect, test } from "bun:test";
import { chunk, remove, shuffle } from "../src/array";

describe( "array utils", () => {
	test( "shuffle returns a new array with same elements in different order", () => {
		const arr = [ 1, 2, 3 ];
		const result = shuffle( arr );
		expect( result.sort() ).toEqual( arr.sort() );
	} );

	test( "shuffle returns empty array when input is empty", () => {
		expect( shuffle( [] ) ).toEqual( [] );
	} );

	test( "chunk splits array into correct sized chunks", () => {
		expect( chunk( [ 1, 2, 3, 4, 5 ], 2 ) ).toEqual( [ [ 1, 2 ], [ 3, 4 ], [ 5 ] ] );
		expect( chunk( [ 1, 2, 3, 4 ], 2 ) ).toEqual( [ [ 1, 2 ], [ 3, 4 ] ] );
		expect( chunk( [ 1, 2, 3 ], 1 ) ).toEqual( [ [ 1 ], [ 2 ], [ 3 ] ] );
	} );

	test( "chunk returns empty array when input is empty", () => {
		expect( chunk( [], 3 ) ).toEqual( [] );
	} );

	test( "remove filters elements based on predicate", () => {
		expect( remove( x => x % 2 === 0, [ 1, 2, 3, 4 ] ) ).toEqual( [ 1, 3 ] );
		expect( remove( x => x > 10, [ 1, 2, 3 ] ) ).toEqual( [ 1, 2, 3 ] );
		expect( remove( _ => true, [ 1, 2, 3 ] ) ).toEqual( [] );
	} );

	test( "remove returns empty array when input is empty", () => {
		expect( remove( () => true, [] ) ).toEqual( [] );
	} );
} );
