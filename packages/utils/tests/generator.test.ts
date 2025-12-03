import { isValid } from "ulid";
import { describe, expect, it, vi } from "vitest";
import {
	generateAvatar,
	generateBotInfo,
	generateGameCode,
	generateId,
	generateName,
	generateSecureRandomString,
	generateTeamName
} from "../src/generator.ts";

vi.mock( "unique-names-generator", () => ( {
	uniqueNamesGenerator: vi.fn( ( opts ) => {
		if ( opts.dictionaries.length === 1 ) {
			return "MockName";
		}
		if ( opts.dictionaries.length === 2 ) {
			return "MockAdjective MockName";
		}
		return "Mock";
	} ),
	adjectives: [ "MockAdjective" ],
	names: [ "MockName" ]
} ) );

describe( "generator utils", () => {
	it( "generateId returns a ULID string", () => {
		expect( isValid( generateId() ) ).toBeTruthy();
	} );

	it( "generateName returns a unique name", () => {
		expect( generateName() ).toBe( "MockName" );
	} );

	it( "generateTeamName returns a unique team name", () => {
		expect( generateTeamName() ).toBe( "MockAdjective MockName" );
	} );

	it( "generateAvatar returns a URL with provided seed", () => {
		expect( generateAvatar( "seed123" ) ).toMatch(
			/^https:\/\/api\.dicebear\.com\/7\.x\/open-peeps\/png\?seed=seed123&r=50$/
		);
	} );

	it( "generateAvatar returns a URL with ulid if no seed", () => {
		expect( generateAvatar() ).toMatch(
			/^https:\/\/api\.dicebear\.com\/7\.x\/open-peeps\/png\?seed=.+&r=50$/
		);
	} );

	it( "generateBotInfo returns an object with id, name, username, avatar", () => {
		const bot = generateBotInfo();
		expect( isValid( bot.id ) ).toBeTruthy();
		expect( isValid( bot.username ) ).toBeTruthy();
		expect( bot.name ).toBe( "MockName" );
		expect( bot.avatar ).toMatch(
			/^https:\/\/api\.dicebear\.com\/7\.x\/open-peeps\/png\?seed=.+&r=50$/
		);
	} );

	it( "generateGameCode returns a string of given length", () => {
		expect( generateGameCode( 8 ) ).toHaveLength( 8 );
		expect( generateGameCode( 4 ) ).toHaveLength( 4 );
	} );

	it( "generateGameCode defaults to length 6", () => {
		expect( generateGameCode() ).toHaveLength( 6 );
	} );

	it( "generateSecureRandomString returns a string of length 24", () => {
		const str = generateSecureRandomString();
		expect( typeof str ).toBe( "string" );
		expect( str ).toHaveLength( 24 );
	} );

	it( "generateSecureRandomString only contains allowed characters", () => {
		const allowed = "abcdefghijkmnpqrstuvwxyz23456789";
		const str = generateSecureRandomString();
		for ( const char of str ) {
			expect( allowed ).toContain( char );
		}
	} );
} );
