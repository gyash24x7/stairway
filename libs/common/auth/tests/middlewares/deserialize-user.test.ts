import { deserializeUser, signJwt } from "src";
import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { Db, IUser } from "libs/utils/src";
import { Connection, RTable } from "rethinkdb-ts";
import process from "process";
import { SignJWT } from "jose";

describe( "Deserialize User Middleware", () => {

	const mockUser: IUser = {
		name: "Mock User",
		id: "subject",
		email: "mock@email.com",
		avatar: "",
		salt: "random-salt"
	};

	const mockConnection = mockDeep<Connection>();
	const mockDb = mockDeep<Db>();
	const mockUsersTable = mockDeep<RTable<IUser>>();

	const mockNextFn = vi.fn();
	const mockReq = mockDeep<Request>();
	const mockRes = mockDeep<Response>();

	process.env[ "JWT_SECRET" ] = "mock-jwt-secret";
	mockRes.locals[ "userId" ] = undefined;

	beforeEach( () => {
		mockRes.locals[ "userId" ] = undefined;
	} );

	it( "should call next if no token without setting user id", async () => {
		mockReq.headers.authorization = undefined;
		mockReq.headers[ "x-refresh" ] = undefined;
		mockReq.cookies[ "accessToken" ] = undefined;
		mockReq.cookies[ "refreshToken" ] = undefined;

		const middleware = deserializeUser( mockConnection, mockDb );
		await middleware( mockReq, mockRes, mockNextFn );
		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ "userId" ] ).toBeUndefined();
	} );

	it( "should read access token and call next with the user id set in locals", async () => {
		const accessToken = await signJwt( "subject", "15m" );
		const refreshToken = await signJwt( "subject", "1y" );
		mockReq.headers.authorization = `Bearer ${ accessToken }`;
		mockReq.headers[ "x-refresh" ] = refreshToken;
		mockReq.cookies[ "accessToken" ] = undefined;
		mockReq.cookies[ "refreshToken" ] = undefined;

		const middleware = deserializeUser( mockConnection, mockDb );
		await middleware( mockReq, mockRes, mockNextFn );
		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ "userId" ] ).toBe( "subject" );
	} );

	it( "should call next when access token is expired refresh token is not present", async () => {
		const secret = new TextEncoder().encode( process.env[ "JWT_SECRET" ] );
		const accessToken = await new SignJWT( {} )
			.setProtectedHeader( { alg: "HS256" } )
			.setIssuedAt()
			.setAudience( "stairway:api" )
			.setExpirationTime( 0 )
			.setSubject( "subject" )
			.sign( secret );
		mockReq.headers.authorization = `Bearer ${ accessToken }`;
		mockReq.headers[ "x-refresh" ] = undefined;
		mockReq.cookies[ "accessToken" ] = undefined;
		mockReq.cookies[ "refreshToken" ] = undefined;

		const middleware = deserializeUser( mockConnection, mockDb );
		await middleware( mockReq, mockRes, mockNextFn );
		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ "userId" ] ).toBeUndefined();
	} );

	it( "should not re-issue access token when access token is expired but user not present", async () => {
		mockUsersTable.filter.mockReturnValue( mockUsersTable );
		mockUsersTable.run.mockResolvedValue( [] );
		mockDb.users.mockReturnValue( mockUsersTable );

		const secret = new TextEncoder().encode( process.env[ "JWT_SECRET" ] );
		const accessToken = await new SignJWT( {} )
			.setProtectedHeader( { alg: "HS256" } )
			.setIssuedAt()
			.setAudience( "stairway:api" )
			.setExpirationTime( 0 )
			.setSubject( "subject" )
			.sign( secret );

		const refreshToken = await signJwt( "subject", "1y" );
		mockReq.headers.authorization = `Bearer ${ accessToken }`;
		mockReq.headers[ "x-refresh" ] = refreshToken;
		mockReq.cookies[ "accessToken" ] = undefined;
		mockReq.cookies[ "refreshToken" ] = undefined;

		const middleware = deserializeUser( mockConnection, mockDb );
		await middleware( mockReq, mockRes, mockNextFn );
		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ "userId" ] ).toBeUndefined();
	} );

	it( "should re-issue access token and call next when access token is expired", async () => {
		mockUsersTable.filter.mockReturnValue( mockUsersTable );
		mockUsersTable.run.mockResolvedValue( [ mockUser ] );
		mockDb.users.mockReturnValue( mockUsersTable );

		const secret = new TextEncoder().encode( process.env[ "JWT_SECRET" ] || "" );
		const accessToken = await new SignJWT( {} )
			.setProtectedHeader( { alg: "HS256" } )
			.setIssuedAt()
			.setAudience( "stairway:api" )
			.setExpirationTime( 0 )
			.setSubject( "subject" )
			.sign( secret );

		const refreshToken = await signJwt( "subject", "1y" );
		mockReq.headers.authorization = `Bearer ${ accessToken }`;
		mockReq.headers[ "x-refresh" ] = refreshToken;
		mockReq.cookies[ "accessToken" ] = undefined;
		mockReq.cookies[ "refreshToken" ] = undefined;

		const middleware = deserializeUser( mockConnection, mockDb );
		await middleware( mockReq, mockRes, mockNextFn );
		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ "userId" ] ).toBe( "subject" );
	} );

	afterEach( () => {
		mockReset( mockReq );
		mockReset( mockRes );
		mockReset( mockConnection );
		mockReset( mockDb );
		mockReset( mockUsersTable );
		mockReset( mockNextFn );
	} );
} );