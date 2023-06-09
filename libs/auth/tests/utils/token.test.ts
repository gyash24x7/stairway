import { createId } from "@paralleldrive/cuid2";
import { jwtVerify } from "jose";
import process from "process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { reIssueAccessToken, signJwt, verifyJwt } from "@s2h/auth";
import { Db, IUser } from "@s2h/utils";
import { Connection, RTable } from "rethinkdb-ts";

describe( "Sign JWT", () => {

	it( "should generate access token with 15m expiration", async () => {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const token = await signJwt( "subject", "15m" );
		const { payload } = await jwtVerify( token, new TextEncoder().encode( "jwtSecret" ) );

		expect( payload.sub ).toBe( "subject" );
		expect( payload.exp! - payload.iat! ).toBe( 15 * 60 );
	} );

	it( "should generate refresh token with 1y expiration", async () => {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const token = await signJwt( "subject", "1y" );
		const { payload } = await jwtVerify( token, new TextEncoder().encode( "jwtSecret" ) );

		expect( payload.sub ).toBe( "subject" );
		expect( payload.exp! - payload.iat! ).toBe( 365.25 * 24 * 60 * 60 );
	} );
} );

describe( "Verify JWT", () => {

	it( "should throw error if token expired", async () => {
		process.env[ "JWT_SECRET" ] = "jwtSecret";

		const token = await signJwt( "subject", "0s" );
		const { valid, expired } = await verifyJwt( token );

		expect( valid ).toBeFalsy();
		expect( expired ).toBeTruthy();
	} );

	it( "should throw error if other error", async () => {
		process.env[ "JWT_SECRET" ] = "jwtSecret1";
		const token = await signJwt( "subject", "15m" );

		process.env[ "JWT_SECRET" ] = "jwtSecret2";
		const { valid, expired } = await verifyJwt( token );

		expect( valid ).toBeFalsy();
		expect( expired ).toBeFalsy();
	} );

	it( "should verify token successfully", async () => {
		process.env[ "JWT_SECRET" ] = "jwtSecret";

		const token = await signJwt( "subject", "15m" );
		const { valid, expired, subject } = await verifyJwt( token );

		expect( valid ).toBeTruthy();
		expect( expired ).toBeFalsy();
		expect( subject ).toBe( "subject" );
	} );
} );

describe( "ReIssue Access Token", async () => {

	const mockUser: IUser = {
		id: createId(),
		name: "name",
		email: "email",
		salt: "saltAsSubject",
		avatar: ""
	};

	const mockConnection = mockDeep<Connection>();
	const mockDb = mockDeep<Db>();
	const mockUsersTable = mockDeep<RTable<IUser>>();

	beforeEach( () => {
		mockUsersTable.filter.mockReturnValue( mockUsersTable );
		mockUsersTable.run.mockResolvedValue( [ mockUser ] );
		mockDb.users.mockReturnValue( mockUsersTable );
	} );

	it( "should return undefined if subject not present", async () => {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const refreshToken = await signJwt( "", "1y" );
		const newToken = await reIssueAccessToken( refreshToken, mockConnection, mockDb );

		expect( newToken ).toBeUndefined();
		expect( mockUsersTable.filter ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should return undefined if user does not exist", async () => {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const refreshToken = await signJwt( "saltAsSubject", "1y" );

		mockUsersTable.run.mockResolvedValue( [] );
		const newToken = await reIssueAccessToken( refreshToken, mockConnection, mockDb );

		expect( newToken ).toBeUndefined();
		expect( mockUsersTable.run ).toHaveBeenCalledWith( mockConnection );
		expect( mockUsersTable.filter ).toHaveBeenCalledWith(
			expect.objectContaining( { salt: "saltAsSubject" } )
		);
	} );

	it( "should return new token if user is present", async () => {
		process.env[ "JWT_SECRET" ] = "jwtSecret";
		const refreshToken = await signJwt( "saltAsSubject", "1y" );

		const newToken = await reIssueAccessToken( refreshToken, mockConnection, mockDb );

		expect( newToken ).toBeTruthy();
		expect( mockUsersTable.run ).toHaveBeenCalledWith( mockConnection );
		expect( mockUsersTable.filter ).toHaveBeenCalledWith(
			expect.objectContaining( { salt: "saltAsSubject" } )
		);
	} );

	afterEach( () => {
		mockReset( mockConnection );
		mockReset( mockDb );
		mockReset( mockUsersTable );
		vi.clearAllMocks();
	} );
} );