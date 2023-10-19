import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AppConfig } from "@s2h/core";
import { JwtService } from "../../src/services";
import * as jose from "jose";
import { unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

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

	beforeAll( async () => {
		const { privateKey, publicKey } = await jose.generateKeyPair( "RS256" );
		await writeFile(
			join( __dirname, mockConfig.auth.privateKeyPath ),
			await jose.exportPKCS8( privateKey )
		);

		await writeFile(
			join( __dirname, mockConfig.auth.publicKeyPath ),
			await jose.exportSPKI( publicKey )
		);
	} );

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

	afterAll( async () => {
		await unlink( join( __dirname, mockConfig.auth.publicKeyPath ) );
		await unlink( join( __dirname, mockConfig.auth.privateKeyPath ) );
	} );

} );