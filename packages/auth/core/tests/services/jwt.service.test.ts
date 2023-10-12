import { describe, expect, it } from "vitest";
import type { AppConfig } from "@s2h/core";
import { JwtService } from "../../src/services";

describe( "JwtService", () => {

	const mockConfig: AppConfig = {
		auth: {
			audience: "audience",
			domain: "domain",
			privateKeyPath: "../../tests/services/__mocks__/keys/.private.key",
			publicKeyPath: "../../tests/services/__mocks__/keys/.public.key.pem"
		},
		db: {
			url: "dbUrl"
		},
		appInfo: {
			id: "stairway",
			name: "Stairway",
			host: "localhost",
			port: 8000
		}
	};

	it( "should throw error if invalid token", async () => {
		const jwtService = new JwtService( mockConfig );
		const signedToken = "some-random-token";
		const authInfo = await jwtService.verify( signedToken );

		expect( authInfo ).toBeNull();
	} );

	it( "should sign the token correctly and verify it", async () => {
		const jwtService = new JwtService( mockConfig );
		const signedToken = await jwtService.sign( {
			id: "abcdEfg",
			name: "Test User",
			email: "test@email.com",
			verified: true,
			avatar: "avatar"
		} );

		expect( signedToken ).toBeDefined();

		const authInfo = await jwtService.verify( signedToken );
		expect( authInfo ).toBeDefined();
		expect( authInfo?.id ).toBe( "abcdEfg" );
		expect( authInfo?.name ).toBe( "Test User" );
		expect( authInfo?.email ).toBe( "test@email.com" );
		expect( authInfo?.verified ).toBe( true );
		expect( authInfo?.avatar ).toBe( "avatar" );
	} );
} );