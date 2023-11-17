import type { Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { Constants } from "../../src/auth/auth.constants";
import { AuthMiddleware } from "../../src/auth/auth.middleware";
import type { AuthService } from "../../src/auth/auth.service";
import type { JwtService } from "../../src/auth/jwt.service";

describe( "AuthMiddleware", () => {

	const accessToken = "MOCK_ACCESS_TOKEN";
	const refreshToken = "MOCK_REFRESH_TOKEN";
	const subject = "subject";

	const mockNextFn = vi.fn();
	const mockReq = mockDeep<Request>();
	const mockRes = mockDeep<Response>();
	mockRes.locals[ Constants.AUTH_USER_ID ] = undefined;

	const mockJwtService = mockDeep<JwtService>();
	const mockAuthService = mockDeep<AuthService>();

	it( "should call next if no token without setting user id", async () => {
		mockReq.cookies[ Constants.AUTH_COOKIE ] = undefined;
		mockReq.cookies[ Constants.REFRESH_COOKIE ] = undefined;

		const middleware = new AuthMiddleware( mockAuthService, mockJwtService );
		await middleware.use( mockReq, mockRes, mockNextFn );

		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ Constants.AUTH_USER_ID ] ).toBeUndefined();
	} );

	it( "should read access token and call next with the user id set in locals", async () => {
		mockReq.cookies[ Constants.AUTH_COOKIE ] = accessToken;
		mockReq.cookies[ Constants.REFRESH_COOKIE ] = refreshToken;
		mockJwtService.verify.mockReturnValue( { valid: true, expired: false, subject } );

		const middleware = new AuthMiddleware( mockAuthService, mockJwtService );
		await middleware.use( mockReq, mockRes, mockNextFn );

		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ Constants.AUTH_USER_ID ] ).toBe( subject );
	} );

	it( "should call next when access token is expired refresh token is not present", async () => {
		mockReq.cookies[ Constants.AUTH_COOKIE ] = accessToken;
		mockReq.cookies[ Constants.REFRESH_COOKIE ] = undefined;
		mockJwtService.verify.mockReturnValue( { valid: false, expired: true } );

		const middleware = new AuthMiddleware( mockAuthService, mockJwtService );
		await middleware.use( mockReq, mockRes, mockNextFn );

		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ Constants.AUTH_USER_ID ] ).toBeUndefined();
	} );

	it( "should call next when access token is expired but new access token is not issued", async () => {
		mockReq.cookies[ Constants.AUTH_COOKIE ] = accessToken;
		mockReq.cookies[ Constants.REFRESH_COOKIE ] = refreshToken;
		mockJwtService.verify.mockReturnValue( { valid: false, expired: true } );
		mockAuthService.reIssueAccessToken.mockResolvedValue( undefined );

		const middleware = new AuthMiddleware( mockAuthService, mockJwtService );
		await middleware.use( mockReq, mockRes, mockNextFn );

		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ Constants.AUTH_USER_ID ] ).toBeUndefined();
	} );

	it( "should re-issue access token and call next when access token is expired", async () => {
		mockReq.cookies[ Constants.AUTH_COOKIE ] = accessToken;
		mockReq.cookies[ Constants.REFRESH_COOKIE ] = refreshToken;
		mockJwtService.verify.mockReturnValueOnce( { valid: false, expired: true } )
			.mockReturnValueOnce( { valid: true, expired: false, subject } );
		mockAuthService.reIssueAccessToken.mockResolvedValue( accessToken );

		const middleware = new AuthMiddleware( mockAuthService, mockJwtService );
		await middleware.use( mockReq, mockRes, mockNextFn );

		expect( mockNextFn ).toHaveBeenCalledTimes( 1 );
		expect( mockRes.locals[ Constants.AUTH_USER_ID ] ).toBe( subject );
	} );

	afterEach( () => {
		mockClear( mockReq );
		mockClear( mockRes );
		mockClear( mockNextFn );
		mockClear( mockJwtService );
		mockClear( mockAuthService );

		mockRes.locals[ Constants.AUTH_USER_ID ] = undefined;
	} );
} );