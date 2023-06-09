import { accessTokenCookieOptions, handleLogout, refreshTokenCookieOptions } from "src";
import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import type { DeepMockProxy } from "vitest-mock-extended";
import { mockDeep } from "vitest-mock-extended";

describe( "Logout Handler", () => {

	it( "should clear all the token cookies", () => {
		const handler = handleLogout();
		const reqMock: DeepMockProxy<Request> = mockDeep();

		const resMock: DeepMockProxy<Response> = mockDeep();
		resMock.send.mockReturnValue( resMock );

		handler( reqMock, resMock );

		expect( resMock.send ).toHaveBeenCalledWith( {} );
		expect( resMock.clearCookie ).toHaveBeenCalledWith( "accessToken", accessTokenCookieOptions );
		expect( resMock.clearCookie ).toHaveBeenCalledWith( "refreshToken", refreshTokenCookieOptions );
	} );
} );