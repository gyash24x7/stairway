import { HttpStatus } from "@nestjs/common";
import type { User } from "@prisma/client";
import type { Response } from "express";
import { afterEach, describe, expect, it } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { accessTokenCookieOptions, Constants, refreshTokenCookieOptions } from "../../src/auth/auth.constants";
import { AuthController } from "../../src/auth/auth.controller";
import type { AuthService } from "../../src/auth/auth.service";

describe( "AuthController", () => {

	const mockAuthService = mockDeep<AuthService>();
	const mockAuthUser = mockDeep<User>();

	it( "should return authUser when getAuthInfo is called", async () => {
		const controller = new AuthController( mockAuthService );
		const authUser = await controller.getAuthUser( mockAuthUser );

		expect( authUser ).toEqual( mockAuthUser );
	} );

	it( "should set cookies when handleAuthCallback is called", async () => {
		const accessToken = "MOCK_ACCESS_TOKEN";
		const refreshToken = "MOCK_REFRESH_TOKEN";
		const code = "MOCK_AUTH_CODE";

		const mockRes = mockDeep<Response>();
		mockAuthService.handleAuthCallback.mockResolvedValue( { accessToken, refreshToken } );

		const controller = new AuthController( mockAuthService );
		await controller.handleAuthCallback( code, mockRes );

		expect( mockAuthService.handleAuthCallback ).toHaveBeenCalledWith( code );
		expect( mockRes.cookie ).toHaveBeenCalledTimes( 2 );
		expect( mockRes.cookie ).toHaveBeenCalledWith( Constants.AUTH_COOKIE, accessToken, accessTokenCookieOptions );
		expect( mockRes.cookie )
			.toHaveBeenCalledWith( Constants.REFRESH_COOKIE, refreshToken, refreshTokenCookieOptions );
	} );

	it( "should remove all cookies when logout is called", async () => {
		const mockRes = mockDeep<Response>();
		mockRes.status.mockReturnValue( mockRes );
		const controller = new AuthController( mockAuthService );

		controller.logout( mockRes );

		expect( mockRes.clearCookie ).toHaveBeenCalledTimes( 2 );
		expect( mockRes.clearCookie ).toHaveBeenCalledWith( Constants.AUTH_COOKIE, accessTokenCookieOptions );
		expect( mockRes.clearCookie ).toHaveBeenCalledWith( Constants.REFRESH_COOKIE, refreshTokenCookieOptions );
		expect( mockRes.status ).toHaveBeenCalledWith( HttpStatus.NO_CONTENT );
		expect( mockRes.send ).toHaveBeenCalledOnce();
	} );

	afterEach( () => {
		mockClear( mockAuthService );
		mockClear( mockAuthUser );
	} );
} );