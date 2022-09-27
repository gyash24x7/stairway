import { DeepMockProxy, mockDeep, mockReset } from "jest-mock-extended";
import type { PrismaClient, User } from "@prisma/client";
import type { Request, Response } from "express";
import { handleAuthCallback } from "@s2h/auth";
import type { GoogleUserResult } from "@s2h/utils";
import axios from "axios";
import cuid from "cuid";
import { accessTokenCookieOptions, refreshTokenCookieOptions } from "../../src/utils/token";

jest.mock( "axios" );
const mockedAxios = axios as jest.Mocked<typeof axios>

describe( "Auth Callback Handler", function () {
    const accessToken = "MOCK_ACCESS_TOKEN";
    const idToken = "MOCK_ID_TOKEN";
    const googleUserResult: GoogleUserResult = {
        id: "id",
        email: "email",
        verified_email: true,
        name: "name",
        given_name: "givenName",
        family_name: "familyName",
        picture: "picture",
        locale: "locale"
    };

    const user: User = {
        id: cuid(),
        name: "name",
        email: "email",
        salt: "salt",
        avatar: ""
    };

    const prismaMock: DeepMockProxy<PrismaClient> = mockDeep();
    const reqMock: DeepMockProxy<Request> = mockDeep();
    const resMock: DeepMockProxy<Response<any, Record<string, any>>> = mockDeep();

    process.env[ "JWT_SECRET" ] = "jwt_secret"

    beforeEach( function () {
        mockedAxios.post.mockResolvedValue( { data: { access_token: accessToken, id_token: idToken } } );
        mockedAxios.get.mockResolvedValue( { data: googleUserResult } );

        prismaMock.user.findUnique.mockResolvedValue( user );
        prismaMock.user.create.mockResolvedValue( user );

        reqMock.query[ "code" ] = "MOCK_AUTH_CODE";

        resMock.status.mockReturnValue( resMock );
        resMock.cookie.mockReturnValue( resMock );
    } );

    afterEach( function () {
        mockReset( mockedAxios );
        mockReset( prismaMock );
        mockReset( resMock );
        mockReset( resMock );
    } );

    it( "should return 403 is email not verified", async function () {
        mockedAxios.get.mockResolvedValue( { data: { ...googleUserResult, verified_email: false } } );
        const handler = handleAuthCallback( prismaMock );

        await handler( reqMock, resMock );
        expect( mockedAxios.post ).toHaveBeenCalledWith(
            expect.stringMatching( /MOCK_AUTH_CODE/ ),
            expect.objectContaining( { headers: expect.anything() } )
        );
        expect( mockedAxios.get ).toHaveBeenCalledWith(
            expect.stringMatching( /MOCK_ACCESS_TOKEN/ ),
            expect.objectContaining( {
                headers: expect.objectContaining( {
                    Authorization: `Bearer ${ idToken }`
                } )
            } )
        );
        expect( resMock.status ).toHaveBeenCalledWith( 403 );
    } );

    it( "should create new user if user not found and set cookies", async function () {
        prismaMock.user.findUnique.mockResolvedValue( null );
        const handler = handleAuthCallback( prismaMock );

        await handler( reqMock, resMock );
        expect( mockedAxios.post ).toHaveBeenCalledWith(
            expect.stringMatching( /MOCK_AUTH_CODE/ ),
            expect.objectContaining( { headers: expect.anything() } )
        );

        expect( mockedAxios.get ).toHaveBeenCalledWith(
            expect.stringMatching( /MOCK_ACCESS_TOKEN/ ),
            expect.objectContaining( {
                headers: expect.objectContaining( {
                    Authorization: `Bearer ${ idToken }`
                } )
            } )
        );

        expect( prismaMock.user.findUnique ).toHaveBeenCalledWith(
            expect.objectContaining( {
                where: expect.objectContaining( { email: "email" } )
            } )
        );

        expect( prismaMock.user.create ).toHaveBeenCalledWith(
            expect.objectContaining( {
                data: expect.objectContaining( { email: "email", name: "name" } )
            } )
        );

        expect( resMock.cookie ).toHaveBeenCalledTimes( 2 );
        expect( resMock.cookie ).toHaveBeenCalledWith(
            "accessToken",
            expect.any( String ),
            accessTokenCookieOptions
        );
        expect( resMock.cookie ).toHaveBeenCalledWith(
            "refreshToken",
            expect.any( String ),
            refreshTokenCookieOptions
        );
    } );

    it( "should set cookies when user is found", async function () {
        const handler = handleAuthCallback( prismaMock );

        await handler( reqMock, resMock );
        expect( mockedAxios.post ).toHaveBeenCalledWith(
            expect.stringMatching( /MOCK_AUTH_CODE/ ),
            expect.objectContaining( { headers: expect.anything() } )
        );
        expect( mockedAxios.get ).toHaveBeenCalledWith(
            expect.stringMatching( /MOCK_ACCESS_TOKEN/ ),
            expect.objectContaining( {
                headers: expect.objectContaining( {
                    Authorization: `Bearer ${ idToken }`
                } )
            } )
        );

        expect( prismaMock.user.findUnique ).toHaveBeenCalledWith(
            expect.objectContaining( {
                where: expect.objectContaining( { email: "email" } )
            } )
        );

        expect( resMock.cookie ).toHaveBeenCalledTimes( 2 );
        expect( resMock.cookie ).toHaveBeenCalledWith(
            "accessToken",
            expect.any( String ),
            accessTokenCookieOptions
        );
        expect( resMock.cookie ).toHaveBeenCalledWith(
            "refreshToken",
            expect.any( String ),
            refreshTokenCookieOptions
        );
    } );
} );