import { describe, expect, test } from "bun:test";

import { capDevices, MAX_DEVICES, removeEndpoints, upsertDevice } from "@/push/shared/devices.ts";

import type { PushDevice } from "@/push/shared/schema.ts";

/**
 * The push store keeps one KV record per user holding every device they have
 * registered, so all the interesting behaviour is array algebra: a browser
 * re-registering must replace rather than accumulate, dead endpoints must be
 * prunable in one pass, and a user with a drawer full of old phones must not
 * grow the record without bound.
 */

const device = ( endpoint: string, lastSeenAt: number, createdAt = lastSeenAt ): PushDevice => ( {
	endpoint,
	keys: { p256dh: `p-${ endpoint }`, auth: `a-${ endpoint }` },
	createdAt,
	lastSeenAt
} );

describe( "upsertDevice", () => {

	test( "adds a device that has not been seen before", () => {
		const result = upsertDevice( [], device( "one", 100 ), 100 );
		expect( result ).toHaveLength( 1 );
		expect( result[ 0 ]?.endpoint ).toBe( "one" );
	} );

	test( "replaces rather than duplicates when the endpoint is already known", () => {
		// The endpoint is the identity of an installation: a browser handing back
		// the same one is the same device, not a second.
		const existing = [ device( "one", 100 ) ];
		const result = upsertDevice( existing, device( "one", 500 ), 500 );

		expect( result ).toHaveLength( 1 );
		expect( result[ 0 ]?.lastSeenAt ).toBe( 500 );
	} );

	test( "keeps the original createdAt when refreshing a known device", () => {
		// Otherwise every page load would make every device look brand new, and
		// "oldest" would stop meaning anything for capping.
		const existing = [ device( "one", 100, 50 ) ];
		const result = upsertDevice( existing, device( "one", 900 ), 900 );

		expect( result[ 0 ]?.createdAt ).toBe( 50 );
		expect( result[ 0 ]?.lastSeenAt ).toBe( 900 );
	} );

	test( "keeps distinct devices side by side", () => {
		const result = upsertDevice( [ device( "one", 100 ) ], device( "two", 200 ), 200 );
		expect( result.map( entry => entry.endpoint ).sort() ).toEqual( [ "one", "two" ] );
	} );

	test( "caps the record, dropping the least recently seen", () => {
		const existing = Array.from(
			{ length: MAX_DEVICES },
			( _, index ) => device( `old-${ index }`, index + 1 )
		);

		const result = upsertDevice( existing, device( "fresh", 10_000 ), 10_000 );

		expect( result ).toHaveLength( MAX_DEVICES );
		expect( result.some( entry => entry.endpoint === "fresh" ) ).toBe( true );
		// `old-0` had the oldest lastSeenAt, so it is the one that goes.
		expect( result.some( entry => entry.endpoint === "old-0" ) ).toBe( false );
	} );

} );

describe( "removeEndpoints", () => {

	test( "drops every endpoint named", () => {
		const existing = [ device( "one", 1 ), device( "two", 2 ), device( "three", 3 ) ];
		const result = removeEndpoints( existing, [ "one", "three" ] );

		expect( result.map( entry => entry.endpoint ) ).toEqual( [ "two" ] );
	} );

	test( "returns the list untouched when nothing is named", () => {
		const existing = [ device( "one", 1 ) ];
		expect( removeEndpoints( existing, [] ) ).toBe( existing );
	} );

	test( "ignores endpoints that are not registered", () => {
		const existing = [ device( "one", 1 ) ];
		expect( removeEndpoints( existing, [ "nope" ] ) ).toHaveLength( 1 );
	} );

} );

describe( "capDevices", () => {

	test( "leaves a list already within the cap alone", () => {
		const existing = [ device( "one", 1 ), device( "two", 2 ) ];
		expect( capDevices( existing, 5 ) ).toBe( existing );
	} );

	test( "keeps the most recently seen", () => {
		const existing = [ device( "old", 1 ), device( "new", 9 ), device( "mid", 5 ) ];
		const result = capDevices( existing, 2 );

		expect( result.map( entry => entry.endpoint ) ).toEqual( [ "new", "mid" ] );
	} );

} );
