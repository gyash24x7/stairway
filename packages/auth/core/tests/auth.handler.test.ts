import type { User } from "@prisma/client";
import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { accessTokenCookieOptions, Constants, refreshTokenCookieOptions } from "../src/auth.constants";
import { AuthHandler } from "../src/auth.handler";
import type { AuthService } from "../src/auth.service";

describe( "AuthController", () => {

	const mockReq = mockDeep<Request>();
	const mockRes = mockDeep<Response>();
	const mockAuthService = mockDeep<AuthService>();
	const mockAuthUser = mockDeep<User>();

	beforeEach( () => {
		mockReq.query[ "code" ] = undefined;
		mockRes.locals[ Constants.AUTH_USER ] = undefined;
	} );

	it( "should return authUser when getAuthInfo is called", async () => {
		const controller = new AuthHandler( mockAuthService );
		mockRes.locals[ Constants.AUTH_USER ] = mockAuthUser;
		await controller.getAuthUser( mockReq, mockRes );
		expect( mockRes.send ).toHaveBeenCalledWith( mockAuthUser );
	} );

	it( "should set cookies when handleAuthCallback is called", async () => {
		const accessToken = "MOCK_ACCESS_TOKEN";
		const refreshToken = "MOCK_REFRESH_TOKEN";
		const code = "MOCK_AUTH_CODE";

		mockReq.query[ "code" ] = code;
		mockAuthService.handleAuthCallback.mockResolvedValue( { accessToken, refreshToken } );

		const controller = new AuthHandler( mockAuthService );
		await controller.handleAuthCallback( mockReq, mockRes );

		expect( mockAuthService.handleAuthCallback ).toHaveBeenCalledWith( code );
		expect( mockRes.cookie ).toHaveBeenCalledTimes( 2 );
		expect( mockRes.cookie ).toHaveBeenCalledWith( Constants.AUTH_COOKIE, accessToken, accessTokenCookieOptions );
		expect( mockRes.cookie )
			.toHaveBeenCalledWith( Constants.REFRESH_COOKIE, refreshToken, refreshTokenCookieOptions );
		expect( mockRes.redirect ).toHaveBeenCalledWith( "http://localhost:3000" );
	} );

	it( "should remove all cookies when logout is called", async () => {
		const mockRes = mockDeep<Response>();
		mockRes.status.mockReturnValue( mockRes );
		const controller = new AuthHandler( mockAuthService );

		controller.logout( mockReq, mockRes );

		expect( mockRes.clearCookie ).toHaveBeenCalledTimes( 2 );
		expect( mockRes.clearCookie ).toHaveBeenCalledWith( Constants.AUTH_COOKIE, accessTokenCookieOptions );
		expect( mockRes.clearCookie ).toHaveBeenCalledWith( Constants.REFRESH_COOKIE, refreshTokenCookieOptions );
		expect( mockRes.status ).toHaveBeenCalledWith( 204 );
		expect( mockRes.send ).toHaveBeenCalledOnce();
	} );

	afterEach( () => {
		mockClear( mockReq );
		mockClear( mockRes );
		mockClear( mockAuthService );
		mockClear( mockAuthUser );
	} );
} );