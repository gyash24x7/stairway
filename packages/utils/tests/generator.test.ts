import { describe, expect, mock, setSystemTime, test } from "bun:test";
import { isValid } from "ulid";
import {
	generateAvatar,
	generateBotInfo,
	generateGameCode,
	generateId,
	generateName,
	generateSecureRandomString,
	generateTeamName
} from "../src/generator";

mock.module( "unique-names-generator", () => ( {
	uniqueNamesGenerator: mock( ( opts ) => {
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
	test( "generateId returns a ULID string", () => {
		expect( isValid( generateId() ) ).toBeTrue();
	} );

	test( "generateName returns a unique name", () => {
		expect( generateName() ).toBe( "MockName" );
	} );

	test( "generateTeamName returns a unique team name", () => {
		expect( generateTeamName() ).toBe( "MockAdjective MockName" );
	} );

	test( "generateAvatar returns a URL with provided seed", () => {
		expect( generateAvatar( "seed123" ) ).toMatch(
			/^https:\/\/api\.dicebear\.com\/7\.x\/open-peeps\/png\?seed=seed123&r=50$/
		);
	} );

	test( "generateAvatar returns a URL with timestamp if no seed", () => {
		setSystemTime( 1234567890 );
		expect( generateAvatar() ).toContain( "seed=1234567890" );
	} );

	test( "generateBotInfo returns an object with id, name, username, avatar", () => {
		const bot = generateBotInfo();
		expect( isValid( bot.id ) ).toBeTrue();
		expect( isValid( bot.username ) ).toBeTrue();
		expect( bot.name ).toBe( "MockName" );
		expect( bot.avatar ).toMatch(
			/^https:\/\/api\.dicebear\.com\/7\.x\/open-peeps\/png\?seed=.+&r=50$/
		);
	} );

	test( "generateGameCode returns a string of given length", () => {
		expect( generateGameCode( 8 ) ).toHaveLength( 8 );
		expect( generateGameCode( 4 ) ).toHaveLength( 4 );
	} );

	test( "generateGameCode defaults to length 6", () => {
		expect( generateGameCode() ).toHaveLength( 6 );
	} );

	test( "generateSecureRandomString returns a string of length 24", () => {
		const str = generateSecureRandomString();
		expect( typeof str ).toBe( "string" );
		expect( str ).toHaveLength( 24 );
	} );

	test( "generateSecureRandomString only contains allowed characters", () => {
		const allowed = "abcdefghijkmnpqrstuvwxyz23456789";
		const str = generateSecureRandomString();
		for ( const char of str ) {
			expect( allowed ).toContain( char );
		}
	} );
} );
