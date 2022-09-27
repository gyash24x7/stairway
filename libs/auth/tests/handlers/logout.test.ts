import type { DeepMockProxy } from "jest-mock-extended";
import { mockDeep } from "jest-mock-extended";
import type { Request, Response } from "express";
import { handleLogout } from "@s2h/auth";
import { accessTokenCookieOptions, refreshTokenCookieOptions } from "../../src/utils/token";

describe( "Logout Handler", function () {

    it( "should clear all the token cookies", function () {
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