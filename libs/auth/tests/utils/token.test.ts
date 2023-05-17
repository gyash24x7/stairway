import { createId as cuid } from "@paralleldrive/cuid2";
import { jwtVerify } from "jose";
import * as process from "process";
import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import { reIssueAccessToken, signJwt, verifyJwt } from "../../src/utils/token";

describe( "Sign JWT", function () {

	it( "should generate access token with 15m expiration", async function () {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const token = await signJwt( "subject", "15m" );
		const { payload } = await jwtVerify( token, new TextEncoder().encode( "jwtSecret" ) );

		expect( payload.sub ).toBe( "subject" );
		expect( payload.exp! - payload.iat! ).toBe( 15 * 60 );
	} );

	it( "should generate refresh token with 1y expiration", async function () {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const token = await signJwt( "subject", "1y" );
		const { payload } = await jwtVerify( token, new TextEncoder().encode( "jwtSecret" ) );

		expect( payload.sub ).toBe( "subject" );
		expect( payload.exp! - payload.iat! ).toBe( 365.25 * 24 * 60 * 60 );
	} );
} );

describe( "Verify JWT", function () {

	it( "should throw error if token expired", async function () {
		process.env[ "JWT_SECRET" ] = "jwtSecret";

		const token = await signJwt( "subject", "0s" );
		const { valid, expired } = await verifyJwt( token );

		expect( valid ).toBeFalsy();
		expect( expired ).toBeTruthy();
	} );

	it( "should throw error if other error", async function () {
		process.env[ "JWT_SECRET" ] = "jwtSecret1";
		const token = await signJwt( "subject", "15m" );

		process.env[ "JWT_SECRET" ] = "jwtSecret2";
		const { valid, expired } = await verifyJwt( token );

		expect( valid ).toBeFalsy();
		expect( expired ).toBeFalsy();
	} );

	it( "should verify token successfully", async function () {
		process.env[ "JWT_SECRET" ] = "jwtSecret";

		const token = await signJwt( "subject", "15m" );
		const { valid, expired, subject } = await verifyJwt( token );

		expect( valid ).toBeTruthy();
		expect( expired ).toBeFalsy();
		expect( subject ).toBe( "subject" );
	} );
} );

describe( "ReIssue Access Token", async function () {

	const user: User = {
		id: cuid(),
		name: "name",
		email: "email",
		salt: "saltAsSubject",
		avatar: ""
	};

	const prismaMock = mockDeep<PrismaClient>();

	it( "should return undefined if subject not present", async function () {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const refreshToken = await signJwt( "", "1y" );
		const newToken = await reIssueAccessToken( refreshToken, prismaMock );

		expect( newToken ).toBeUndefined();
		expect( prismaMock.user.findUnique ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should return undefined if user does not exist", async function () {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const refreshToken = await signJwt( "saltAsSubject", "1y" );
		prismaMock.user.findUnique.mockResolvedValue( null );
		const newToken = await reIssueAccessToken( refreshToken, prismaMock );

		expect( newToken ).toBeUndefined();
		expect( prismaMock.user.findUnique ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( {
					salt: "saltAsSubject"
				} )
			} )
		);
	} );

	it( "should return new token if user is present", async function () {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const refreshToken = await signJwt( "saltAsSubject", "1y" );
		prismaMock.user.findUnique.mockResolvedValue( user );
		const newToken = await reIssueAccessToken( refreshToken, prismaMock );

		expect( newToken ).toBeTruthy();
		expect( prismaMock.user.findUnique ).toHaveBeenCalledWith(
			expect.objectContaining( {
				where: expect.objectContaining( {
					salt: "saltAsSubject"
				} )
			} )
		);
	} );

} );