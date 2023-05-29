import { createId } from "@paralleldrive/cuid2";
import { accessTokenCookieOptions, handleAuthCallback, refreshTokenCookieOptions } from "@s2h/auth";
import type { Db, GoogleUserResult, IUser } from "@s2h/utils";
import axios from "axios";
import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, Mocked, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import { Connection, RDatum, RTable, WriteResult } from "rethinkdb-ts";

vi.mock( "axios" );

describe( "Auth Callback Handler", () => {
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

	const user: IUser = {
		id: createId(),
		name: "name",
		email: "email",
		salt: "salt",
		avatar: ""
	};

	const reqMock = mockDeep<Request>();
	const resMock = mockDeep<Response<any, Record<string, any>>>();
	const mockUsersTable = mockDeep<RTable<IUser>>();
	const writeResultMock = mockDeep<RDatum<WriteResult<IUser>>>();
	const mockConnection = mockDeep<Connection>();

	const mockedAxios = axios as Mocked<typeof axios>;
	const mockDb = mockDeep<Db>();

	process.env[ "JWT_SECRET" ] = "jwt_secret";

	beforeEach( () => {
		mockedAxios.post.mockResolvedValue( { data: { access_token: accessToken, id_token: idToken } } );
		mockedAxios.get.mockResolvedValue( { data: googleUserResult } );

		mockUsersTable.run.mockResolvedValue( [ user ] );
		mockUsersTable.filter.mockReturnValue( mockUsersTable );

		writeResultMock.run.mockResolvedValue( mockDeep() );
		mockUsersTable.insert.mockReturnValue( writeResultMock );
		mockDb.users.mockReturnValue( mockUsersTable );

		reqMock.query[ "code" ] = "MOCK_AUTH_CODE";

		resMock.status.mockReturnValue( resMock );
		resMock.cookie.mockReturnValue( resMock );
	} );

	it( "should return 403 is email not verified", async () => {
		mockedAxios.get.mockResolvedValue( { data: { ...googleUserResult, verified_email: false } } );
		const handler = handleAuthCallback( mockConnection, mockDb );

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

	it( "should create new user if user not found and set cookies", async () => {
		mockUsersTable.run.mockResolvedValue( [] );
		mockDb.users.mockReturnValue( mockUsersTable );
		const handler = handleAuthCallback( mockConnection, mockDb );

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

		expect( mockUsersTable.filter ).toHaveBeenCalledWith( { email: "email" } );
		expect( mockUsersTable.run ).toHaveBeenCalledWith( mockConnection );

		expect( writeResultMock.run ).toHaveBeenCalledWith( mockConnection );
		expect( mockUsersTable.insert ).toHaveBeenCalledWith(
			expect.objectContaining( { email: "email", name: "name" } )
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

	it( "should set cookies when user is found", async () => {
		const handler = handleAuthCallback( mockConnection, mockDb );

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

		expect( mockUsersTable.filter ).toHaveBeenCalledWith( { email: "email" } );
		expect( mockUsersTable.run ).toHaveBeenCalledWith( mockConnection );

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

	afterEach( () => {
		mockReset( mockedAxios );
		mockReset( mockConnection );
		mockReset( resMock );
		mockReset( resMock );
		mockReset( mockDb );
		mockReset( mockUsersTable );
		mockReset( writeResultMock );
		vi.clearAllMocks();
	} );
} );