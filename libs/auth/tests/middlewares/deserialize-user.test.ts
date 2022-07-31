import { mockDeep, mockReset } from "jest-mock-extended";
import type { PrismaClient, User } from "@prisma/client";
import type { Request, Response } from "express"
import { deserializeUser } from "@s2h/auth";
import { signJwt } from "../../src/utils/token";
import jwt from "jsonwebtoken";

describe( "Deserialize User Middleware", function () {
	const prismaMock = mockDeep<PrismaClient>();
	const mockNextFn = jest.fn();
	const mockReq = mockDeep<Request>();
	const mockRes = mockDeep<Response>();

	const mockUser: User = {
		name: "Mock User",
		id: "subject",
		email: "mock@email.com",
		avatar: "",
		salt: "random-salt"
	};

	process.env[ "JWT_SECRET" ] = "mock-jwt-secret";
	mockRes.locals[ "userId" ] = undefined;

	beforeEach( function () {
		mockRes.locals[ "userId" ] = undefined;
	} );

	afterEach( function () {
		mockReset( mockReq );
		mockReset( mockRes );
		mockReset( prismaMock );
		mockReset( mockNextFn );
	} );

	it( "should call next if no token without setting user id", async function () {
		mockReq.headers.authorization = undefined;
		mockReq.headers[ "x-refresh" ] = undefined;
		mockReq.cookies[ "accessToken" ] = undefined;
		mockReq.cookies[ "refreshToken" ] = undefined;

		const middleware = deserializeUser( prismaMock );
		await middleware( mockReq, mockRes, mockNextFn );
		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ "userId" ] ).toBeUndefined();
	} );

	it( "should read access token and call next with the user id set in locals", async function () {
		const accessToken = signJwt( "subject", "access" );
		const refreshToken = signJwt( "subject", "refresh" );
		mockReq.headers.authorization = `Bearer ${ accessToken }`;
		mockReq.headers[ "x-refresh" ] = refreshToken;
		mockReq.cookies[ "accessToken" ] = undefined;
		mockReq.cookies[ "refreshToken" ] = undefined;

		const middleware = deserializeUser( prismaMock );
		await middleware( mockReq, mockRes, mockNextFn );
		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ "userId" ] ).toBe( "subject" );
	} );

	it( "should call next when access token is expired refresh token is not present", async function () {
		const accessToken = jwt.sign( {}, process.env[ "JWT_SECRET" ]!, { expiresIn: 0, subject: "subject" } );
		mockReq.headers.authorization = `Bearer ${ accessToken }`;
		mockReq.headers[ "x-refresh" ] = undefined;
		mockReq.cookies[ "accessToken" ] = undefined;
		mockReq.cookies[ "refreshToken" ] = undefined;

		const middleware = deserializeUser( prismaMock );
		await middleware( mockReq, mockRes, mockNextFn );
		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ "userId" ] ).toBeUndefined();
	} );

	it( "should re-issue access token and call next when access token is expired", async function () {
		const accessToken = jwt.sign( {}, process.env[ "JWT_SECRET" ]!, { expiresIn: 0, subject: "subject" } );
		const refreshToken = signJwt( "subject", "refresh" );
		mockReq.headers.authorization = `Bearer ${ accessToken }`;
		mockReq.headers[ "x-refresh" ] = refreshToken;
		mockReq.cookies[ "accessToken" ] = undefined;
		mockReq.cookies[ "refreshToken" ] = undefined;

		prismaMock.user.findUnique.mockResolvedValue( mockUser );

		const middleware = deserializeUser( prismaMock );
		await middleware( mockReq, mockRes, mockNextFn );
		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ "userId" ] ).toBe( "subject" );
	} );
} );