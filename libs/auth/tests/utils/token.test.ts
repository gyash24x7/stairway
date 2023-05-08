import type { PrismaClient, User } from "@prisma/client";
import { createId as cuid } from "@paralleldrive/cuid2";
import jwt, { JwtPayload } from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import { reIssueAccessToken, signJwt, verifyJwt } from "../../src/utils/token";

describe( "Sign JWT", function () {

	it( "should throw error if secret not present", function () {
		expect.assertions( 1 );
		try {
			signJwt( "subject", "access" );
		} catch ( e ) {
			expect( e ).toBeTruthy();
		}
	} );

	it( "should generate access token with 15m expiration", function () {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const token = signJwt( "subject", "access" );
		const payload = jwt.verify( token, "jwtSecret" ) as JwtPayload;

		expect( payload.sub ).toBe( "subject" );
		expect( payload.exp! - payload.iat! ).toBe( 15 * 60 );
	} );

	it( "should generate refresh token with 1y expiration", function () {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const token = signJwt( "subject", "refresh" );
		const payload = jwt.verify( token, "jwtSecret" ) as JwtPayload;

		expect( payload.sub ).toBe( "subject" );
		expect( payload.exp! - payload.iat! ).toBe( 365 * 24 * 60 * 60 );
	} );
} );

describe( "Verify JWT", function () {

	it( "should throw error if token expired", function () {
		process.env[ "JWT_SECRET" ] = "jwtSecret";

		const token = jwt.sign( {}, "jwtSecret", { expiresIn: 0 } );
		const { valid, expired } = verifyJwt( token );

		expect( valid ).toBeFalsy();
		expect( expired ).toBeTruthy();
	} );

	it( "should throw error if other error", function () {
		process.env[ "JWT_SECRET" ] = undefined;
		const token = jwt.sign( {}, "jwtSecret", { expiresIn: 200000 } );
		const { valid, expired } = verifyJwt( token );

		expect( valid ).toBeFalsy();
		expect( expired ).toBeFalsy();
	} );

	it( "should verify token successfully", function () {
		process.env[ "JWT_SECRET" ] = "jwtSecret";

		const token = jwt.sign( {}, "jwtSecret", { expiresIn: 20000, subject: "subject" } );
		const { valid, expired, subject } = verifyJwt( token );

		expect( valid ).toBeTruthy();
		expect( expired ).toBeFalsy();
		expect( subject ).toBe( "subject" );
	} );
} );

describe( "ReIssue Access Token", function () {

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
		const refreshToken = signJwt( "", "refresh" );
		const newToken = await reIssueAccessToken( refreshToken, prismaMock );

		expect( newToken ).toBeUndefined();
		expect( prismaMock.user.findUnique ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should return undefined if user does not exist", async function () {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const refreshToken = signJwt( "saltAsSubject", "refresh" );
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
		const refreshToken = signJwt( "saltAsSubject", "refresh" );
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