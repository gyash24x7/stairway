import type { User } from "@prisma/client";
import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { AuthMiddleware } from "../src";
import { Constants, Messages } from "../src/auth.constants";
import type { AuthService } from "../src/auth.service";
import type { JwtService } from "../src/jwt.service";

describe( "AuthMiddleware", () => {

	const accessToken = "MOCK_ACCESS_TOKEN";
	const refreshToken = "MOCK_REFRESH_TOKEN";
	const subject = "subject";

	const mockReq = mockDeep<Request>();
	const mockRes = mockDeep<Response>();
	const mockNextFn = vi.fn();
	const mockUser = mockDeep<User>();
	mockRes.locals[ Constants.AUTH_USER_ID ] = undefined;

	const mockJwtService = mockDeep<JwtService>();
	const mockAuthService = mockDeep<AuthService>();

	beforeEach( () => {
		mockRes.status.mockReturnValue( mockRes );
		mockRes.locals[ Constants.AUTH_USER ] = undefined;
	} );

	it( "should throw error if no access token", async () => {
		mockReq.cookies[ Constants.AUTH_COOKIE ] = undefined;
		mockReq.cookies[ Constants.REFRESH_COOKIE ] = undefined;

		const middleware = new AuthMiddleware( mockAuthService, mockJwtService );
		await middleware.use( mockReq, mockRes, mockNextFn );

		expect( mockRes.status ).toHaveBeenCalledWith( 401 );
		expect( mockRes.send ).toHaveBeenCalledWith( Messages.UNAUTHORIZED );
		expect( mockRes.locals[ Constants.AUTH_USER ] ).toBeUndefined();

	} );

	it( "should read access token and call next with the user id set in locals", async () => {
		mockReq.cookies[ Constants.AUTH_COOKIE ] = accessToken;
		mockReq.cookies[ Constants.REFRESH_COOKIE ] = refreshToken;
		mockJwtService.verify.mockReturnValue( { expired: false, subject } );
		mockAuthService.getAuthUser.mockResolvedValue( mockUser );

		const middleware = new AuthMiddleware( mockAuthService, mockJwtService );
		await middleware.use( mockReq, mockRes, mockNextFn );

		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ Constants.AUTH_USER ] ).toBe( mockUser );
		expect( mockAuthService.getAuthUser ).toHaveBeenCalledWith( subject );
	} );

	it( "should throw error when access token is expired and refresh token is not present", async () => {
		mockReq.cookies[ Constants.AUTH_COOKIE ] = accessToken;
		mockReq.cookies[ Constants.REFRESH_COOKIE ] = undefined;
		mockJwtService.verify.mockReturnValue( { expired: true } );

		const middleware = new AuthMiddleware( mockAuthService, mockJwtService );

		await middleware.use( mockReq, mockRes, mockNextFn );

		expect( mockRes.status ).toHaveBeenCalledWith( 401 );
		expect( mockRes.send ).toHaveBeenCalledWith( Messages.UNAUTHORIZED );
		expect( mockJwtService.verify ).toHaveBeenCalledWith( accessToken );
		expect( mockRes.locals[ Constants.AUTH_USER ] ).toBeUndefined();
	} );

	it( "should throw error when access token is expired but new access token is not issued", async () => {
		mockReq.cookies[ Constants.AUTH_COOKIE ] = accessToken;
		mockReq.cookies[ Constants.REFRESH_COOKIE ] = refreshToken;
		mockJwtService.verify.mockReturnValue( { expired: true } );
		mockAuthService.reIssueAccessToken.mockResolvedValue( undefined );

		const middleware = new AuthMiddleware( mockAuthService, mockJwtService );

		await middleware.use( mockReq, mockRes, mockNextFn );


		expect( mockRes.status ).toHaveBeenCalledWith( 403 );
		expect( mockRes.send ).toHaveBeenCalledWith( Messages.UNAUTHORIZED );
		expect( mockRes.locals[ Constants.AUTH_USER_ID ] ).toBeUndefined();
		expect( mockJwtService.verify ).toHaveBeenCalledWith( accessToken );
		expect( mockAuthService.reIssueAccessToken ).toHaveBeenCalledWith( refreshToken );
	} );

	it( "should re-issue access token and set auth user when access token is expired", async () => {
		mockReq.cookies[ Constants.AUTH_COOKIE ] = accessToken;
		mockReq.cookies[ Constants.REFRESH_COOKIE ] = refreshToken;
		mockJwtService.verify
			.mockReturnValueOnce( { expired: true } )
			.mockReturnValueOnce( { expired: false, subject } );
		mockAuthService.reIssueAccessToken.mockResolvedValue( accessToken );
		mockAuthService.getAuthUser.mockResolvedValue( mockUser );

		const middleware = new AuthMiddleware( mockAuthService, mockJwtService );
		await middleware.use( mockReq, mockRes, mockNextFn );

		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ Constants.AUTH_USER ] ).toBe( mockUser );
		expect( mockJwtService.verify ).toHaveBeenCalledTimes( 2 );
		expect( mockJwtService.verify ).toHaveBeenCalledWith( accessToken );
		expect( mockAuthService.reIssueAccessToken ).toHaveBeenCalledWith( refreshToken );
		expect( mockAuthService.getAuthUser ).toHaveBeenCalledWith( subject );
	} );

	afterEach( () => {
		mockClear( mockReq );
		mockClear( mockRes );
		mockClear( mockNextFn );
		mockClear( mockUser );
		mockClear( mockJwtService );
		mockClear( mockAuthService );
	} );
} );