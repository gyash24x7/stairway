import axios from "axios";
import { mockReset } from "jest-mock-extended";
import { getGoogleToken, getGoogleUser } from "../../src/utils/oauth";
import type { GoogleUserResult } from "@s2h/utils";

jest.mock( "axios" );
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe( "Get Google Token", function () {
	const accessToken = "MOCK_ACCESS_TOKEN";
	const idToken = "MOCK_ID_TOKEN";

	beforeEach( function () {
		mockedAxios.post.mockResolvedValue( { data: { access_token: accessToken, id_token: idToken } } );
	} );

	afterEach( function () {
		mockReset( mockedAxios );
	} );

	it( "should return token data from google", async function () {
		const data = await getGoogleToken( "MOCK_AUTH_CODE" );

		expect( data.access_token ).toBe( accessToken );
		expect( data.id_token ).toBe( idToken );
		expect( mockedAxios.post ).toHaveBeenCalledWith(
			expect.stringMatching( /MOCK_AUTH_CODE/ ),
			expect.objectContaining( { headers: expect.anything() } )
		);
	} );

} );

describe( "Get Google User", function () {
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

	beforeEach( function () {
		mockedAxios.get.mockResolvedValue( { data: googleUserResult } );
	} );

	afterEach( function () {
		mockReset( mockedAxios );
	} );

	it( "should return user data from google", async function () {
		const data = await getGoogleUser( accessToken, idToken );

		expect( data ).toEqual( googleUserResult );
		expect( mockedAxios.get ).toHaveBeenCalledWith(
			expect.stringMatching( /MOCK_ACCESS_TOKEN/ ),
			expect.objectContaining( {
				headers: expect.objectContaining( {
					Authorization: `Bearer ${ idToken }`
				} )
			} )
		);
	} );

} );