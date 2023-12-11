import type { HttpException } from "@common/core";
import type { AuthRepository } from "@common/data";
import superagent, { Response, SuperAgentRequest } from "superagent";
import { afterEach, describe, expect, it, Mocked, vi } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { Messages, TokenType } from "../src/auth.constants";
import { AuthService } from "../src/auth.service";
import type { JwtService } from "../src/jwt.service";

vi.mock( "superagent" );
const mockedSuperagent = superagent as Mocked<typeof superagent>;

describe( "AuthService", () => {
	const accessToken = "MOCK_ACCESS_TOKEN";
	const refreshToken = "MOCK_REFRESH_TOKEN";
	const idToken = "MOCK_ID_TOKEN";
	const googleUserResult = {
		id: "id",
		email: "email",
		verified_email: true,
		name: "name",
		given_name: "givenName",
		family_name: "familyName",
		picture: "picture",
		locale: "locale"
	};

	const mockRepository = mockDeep<AuthRepository>();
	const mockJwtService = mockDeep<JwtService>();
	const mockUser = {
		id: "someId",
		name: googleUserResult.name,
		email: googleUserResult.email,
		avatar: "someAvatar"
	};

	it( "should handle authorization code callback from google when new user with verified email", async () => {
		const getGoogleTokenRequest = mockDeep<SuperAgentRequest>();
		const getGoogleTokenResponse = mockDeep<Response>();
		getGoogleTokenResponse.body = { access_token: accessToken, id_token: idToken };
		getGoogleTokenRequest.set.mockResolvedValue( getGoogleTokenResponse );
		mockedSuperagent.post.mockReturnValue( getGoogleTokenRequest );

		const getGoogleUserRequest = mockDeep<SuperAgentRequest>();
		const getGoogleUserResponse = mockDeep<Response>();
		getGoogleUserResponse.body = googleUserResult;
		getGoogleUserRequest.set.mockResolvedValue( getGoogleUserResponse );
		mockedSuperagent.get.mockReturnValue( getGoogleUserRequest );

		mockRepository.getUserByEmail.mockResolvedValue( undefined );
		mockRepository.createUser.mockResolvedValue( mockUser );

		mockJwtService.sign.mockReturnValueOnce( accessToken ).mockReturnValueOnce( refreshToken );

		const authService = new AuthService( mockRepository, mockJwtService );
		const response = await authService.handleAuthCallback( "MOCK_AUTH_CODE" );

		expect( response.accessToken ).toBe( accessToken );
		expect( response.refreshToken ).toBe( refreshToken );
		expect( mockedSuperagent.post ).toHaveBeenCalledWith( expect.stringMatching( /MOCK_AUTH_CODE/ ) );
		expect( getGoogleTokenRequest.set ).toHaveBeenCalledWith( "Content-Type", "application/x-www-form-urlencoded" );
		expect( mockedSuperagent.get ).toHaveBeenCalledWith( expect.stringMatching( /MOCK_ACCESS_TOKEN/ ) );
		expect( getGoogleUserRequest.set ).toHaveBeenCalledWith( "Authorization", `Bearer ${ idToken }` );
		expect( mockRepository.getUserByEmail ).toHaveBeenCalledWith( googleUserResult.email );
		expect( mockRepository.createUser ).toHaveBeenCalledWith( {
			name: googleUserResult.name,
			email: googleUserResult.email
		} );
	} );

	it( "should handle authorization code callback from google when existing user with verified email", async () => {
		const getGoogleTokenRequest = mockDeep<SuperAgentRequest>();
		const getGoogleTokenResponse = mockDeep<Response>();
		getGoogleTokenResponse.body = { access_token: accessToken, id_token: idToken };
		getGoogleTokenRequest.set.mockResolvedValue( getGoogleTokenResponse );
		mockedSuperagent.post.mockReturnValue( getGoogleTokenRequest );

		const getGoogleUserRequest = mockDeep<SuperAgentRequest>();
		const getGoogleUserResponse = mockDeep<Response>();
		getGoogleUserResponse.body = googleUserResult;
		getGoogleUserRequest.set.mockResolvedValue( getGoogleUserResponse );
		mockedSuperagent.get.mockReturnValue( getGoogleUserRequest );

		mockRepository.getUserByEmail.mockResolvedValue( mockUser );
		mockJwtService.sign.mockReturnValueOnce( accessToken ).mockReturnValueOnce( refreshToken );

		const authService = new AuthService( mockRepository, mockJwtService );
		const response = await authService.handleAuthCallback( "MOCK_AUTH_CODE" );

		expect( response.accessToken ).toBe( accessToken );
		expect( response.refreshToken ).toBe( refreshToken );
		expect( mockedSuperagent.post ).toHaveBeenCalledWith( expect.stringMatching( /MOCK_AUTH_CODE/ ) );
		expect( getGoogleTokenRequest.set ).toHaveBeenCalledWith( "Content-Type", "application/x-www-form-urlencoded" );
		expect( mockedSuperagent.get ).toHaveBeenCalledWith( expect.stringMatching( /MOCK_ACCESS_TOKEN/ ) );
		expect( getGoogleUserRequest.set ).toHaveBeenCalledWith( "Authorization", `Bearer ${ idToken }` );
		expect( mockRepository.getUserByEmail ).toHaveBeenCalledWith( googleUserResult.email );
		expect( mockRepository.createUser ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should handle authorization code callback from google when email not verified", async () => {
		const getGoogleTokenRequest = mockDeep<SuperAgentRequest>();
		const getGoogleTokenResponse = mockDeep<Response>();
		getGoogleTokenResponse.body = { access_token: accessToken, id_token: idToken };
		getGoogleTokenRequest.set.mockResolvedValue( getGoogleTokenResponse );
		mockedSuperagent.post.mockReturnValue( getGoogleTokenRequest );

		const getGoogleUserRequest = mockDeep<SuperAgentRequest>();
		const getGoogleUserResponse = mockDeep<Response>();
		getGoogleUserResponse.body = { ...googleUserResult, verified_email: false };
		getGoogleUserRequest.set.mockResolvedValue( getGoogleUserResponse );
		mockedSuperagent.get.mockReturnValue( getGoogleUserRequest );

		const authService = new AuthService( mockRepository, mockJwtService );

		expect.assertions( 6 );
		await authService.handleAuthCallback( "MOCK_AUTH_CODE" ).catch( ( e: HttpException ) => {
			expect( e.getStatus() ).toBe( 403 );
			expect( e.message ).toBe( Messages.EMAIL_NOT_VERIFIED );
			expect( mockedSuperagent.post ).toHaveBeenCalledWith( expect.stringMatching( /MOCK_AUTH_CODE/ ) );
			expect( getGoogleTokenRequest.set )
				.toHaveBeenCalledWith( "Content-Type", "application/x-www-form-urlencoded" );
			expect( mockedSuperagent.get ).toHaveBeenCalledWith( expect.stringMatching( /MOCK_ACCESS_TOKEN/ ) );
			expect( getGoogleUserRequest.set ).toHaveBeenCalledWith( "Authorization", `Bearer ${ idToken }` );
		} );

	} );

	it( "should return token data from google when getGoogleToken is called", async () => {
		const mockSuperagentRequest = mockDeep<SuperAgentRequest>();
		const mockSuperagentResponse = mockDeep<Response>();
		mockSuperagentResponse.body = { access_token: accessToken, id_token: idToken };
		mockSuperagentRequest.set.mockResolvedValue( mockSuperagentResponse );
		mockedSuperagent.post.mockReturnValue( mockSuperagentRequest );

		const authService = new AuthService( mockRepository, mockJwtService );
		const data = await authService.getGoogleToken( "MOCK_AUTH_CODE" );

		expect( data.access_token ).toBe( accessToken );
		expect( data.id_token ).toBe( idToken );
		expect( mockedSuperagent.post ).toHaveBeenCalledWith( expect.stringMatching( /MOCK_AUTH_CODE/ ) );
		expect( mockSuperagentRequest.set ).toHaveBeenCalledWith( "Content-Type", "application/x-www-form-urlencoded" );
	} );

	it( "should return user data from google when getGoogleUser is called", async () => {
		const mockSuperagentRequest = mockDeep<SuperAgentRequest>();
		const mockSuperagentResponse = mockDeep<Response>();
		mockSuperagentResponse.body = googleUserResult;
		mockSuperagentRequest.set.mockResolvedValue( mockSuperagentResponse );
		mockedSuperagent.get.mockReturnValue( mockSuperagentRequest );

		const authService = new AuthService( mockRepository, mockJwtService );
		const data = await authService.getGoogleUser( accessToken, idToken );

		expect( data ).toEqual( googleUserResult );
		expect( mockedSuperagent.get ).toHaveBeenCalledWith( expect.stringMatching( /MOCK_ACCESS_TOKEN/ ) );
		expect( mockSuperagentRequest.set ).toHaveBeenCalledWith( "Authorization", `Bearer ${ idToken }` );
	} );

	it( "should return undefined if subject not present when re-issuing refresh token", async () => {
		mockJwtService.verify.mockReturnValue( { expired: false, subject: "" } );

		const authService = new AuthService( mockRepository, mockJwtService );
		const newToken = await authService.reIssueAccessToken( "refreshToken" );

		expect( newToken ).toBeUndefined();
		expect( mockJwtService.verify ).toHaveBeenCalledWith( "refreshToken" );
		expect( mockRepository.getUserById ).toHaveBeenCalledTimes( 0 );
	} );

	it( "should return undefined if user does not exist when re-issuing refresh token", async () => {
		mockRepository.getUserById.mockResolvedValue( undefined );
		mockJwtService.verify.mockReturnValue( { expired: false, subject: "subject" } );

		const authService = new AuthService( mockRepository, mockJwtService );
		const newToken = await authService.reIssueAccessToken( "refreshToken" );

		expect( newToken ).toBeUndefined();
		expect( mockJwtService.verify ).toHaveBeenCalledWith( "refreshToken" );
		expect( mockRepository.getUserById ).toHaveBeenCalledWith( "subject" );
	} );

	it( "should return new token if user is present when re-issuing refresh token", async () => {
		mockRepository.getUserById.mockResolvedValue( mockDeep() );
		mockJwtService.verify.mockReturnValue( { expired: false, subject: "subject" } );
		mockJwtService.sign.mockReturnValue( "accessToken" );

		const authService = new AuthService( mockRepository, mockJwtService );
		const newToken = await authService.reIssueAccessToken( "refreshToken" );

		expect( newToken ).toBeDefined();
		expect( mockJwtService.verify ).toHaveBeenCalledWith( "refreshToken" );
		expect( mockRepository.getUserById ).toHaveBeenCalledWith( "subject" );
		expect( mockJwtService.sign ).toHaveBeenCalledWith( "subject", TokenType.ACCESS_TOKEN );
	} );

	afterEach( () => {
		mockClear( mockRepository );
		mockClear( mockJwtService );
		mockClear( mockedSuperagent );
	} );
} );
