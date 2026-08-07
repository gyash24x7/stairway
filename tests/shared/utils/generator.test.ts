import { describe, expect, it } from "bun:test";

import {
	generateAvatar,
	generateBotInfo,
	generateGameCode,
	generateId,
	generateName,
	generateTeamName
} from "@/shared/utils/generator.ts";

describe( "generateId", () => {
	it( "returns a 26-char Crockford base32 ULID", () => {
		const id = generateId();
		expect( id ).toMatch( /^[0-9A-HJKMNP-TV-Z]{26}$/ );
	} );

	it( "returns a unique value on each call", () => {
		const ids = new Set( Array.from( { length: 100 }, () => generateId() ) );
		expect( ids.size ).toBe( 100 );
	} );
} );

describe( "generateName", () => {
	it( "returns a single-word non-empty name", () => {
		const name = generateName();
		expect( typeof name ).toBe( "string" );
		expect( name.length ).toBeGreaterThan( 0 );
		expect( name.trim() ).not.toContain( " " );
	} );
} );

describe( "generateTeamName", () => {
	it( "returns a two-word name (adjective + name)", () => {
		const team = generateTeamName();
		expect( team.split( " " ) ).toHaveLength( 2 );
	} );
} );

describe( "generateAvatar", () => {
	it( "builds a DiceBear open-peeps URL using the provided seed", () => {
		expect( generateAvatar( "yash" ) ).toBe(
			"https://api.dicebear.com/7.x/open-peeps/png?seed=yash&r=50"
		);
	} );

	it( "falls back to a generated id when no seed is given", () => {
		const url = generateAvatar();
		expect( url ).toMatch(
			/^https:\/\/api\.dicebear\.com\/7\.x\/open-peeps\/png\?seed=[0-9A-HJKMNP-TV-Z]{26}&r=50$/
		);
	} );
} );

describe( "generateBotInfo", () => {
	it( "returns a fully-populated bot record flagged isBot", () => {
		const bot = generateBotInfo();
		expect( bot.isBot ).toBe( true );
		expect( bot.id ).toMatch( /^[0-9A-HJKMNP-TV-Z]{26}$/ );
		expect( bot.username ).toMatch( /^[0-9A-HJKMNP-TV-Z]{26}$/ );
		expect( bot.id ).not.toBe( bot.username );
		expect( typeof bot.name ).toBe( "string" );
		expect( bot.name.length ).toBeGreaterThan( 0 );
		expect( bot.avatar ).toContain( "https://api.dicebear.com/7.x/open-peeps/png?seed=" );
	} );
} );

describe( "generateGameCode", () => {
	it( "defaults to a 6-character code", () => {
		expect( generateGameCode() ).toHaveLength( 6 );
	} );

	it( "honors a requested length", () => {
		expect( generateGameCode( 10 ) ).toHaveLength( 10 );
		expect( generateGameCode( 1 ) ).toHaveLength( 1 );
	} );

	it( "returns an empty string for length 0", () => {
		expect( generateGameCode( 0 ) ).toBe( "" );
	} );

	it( "uses only uppercase alphanumeric characters", () => {
		for ( let i = 0; i < 50; i++ ) {
			expect( generateGameCode( 12 ) ).toMatch( /^[0-9A-Z]{12}$/ );
		}
	} );
} );
