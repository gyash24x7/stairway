import { afterEach, describe, expect, it, vi } from "vitest";
import { mockDeep } from "vitest-mock-extended";
import { auth, initializeContext } from "../src/router.ts";
import { getLoginOptions, getRegisterOptions, userExists, verifyLogin, verifyRegistration } from "../src/service.ts";
import { createSession, deleteSession, validateSession } from "../src/sessions.ts";
import type { AuthInfo, Session } from "../src/types.ts";

vi.mock( "../src/service.ts", () => ( {
	getRegisterOptions: vi.fn(),
	getLoginOptions: vi.fn(),
	userExists: vi.fn(),
	verifyRegistration: vi.fn(),
	verifyLogin: vi.fn()
} ) );

vi.mock( "../src/sessions.ts", () => ( {
	createSession: vi.fn(),
	deleteSession: vi.fn(),
	validateSession: vi.fn()
} ) );

describe( "Auth:Router", () => {

	const mockEnv = {
		DB: mockDeep<D1Database>()
	};

	const headers = new Headers( {
		"Content-Type": "application/json"
	} );

	const mockUser: AuthInfo = {
		id: "1",
		username: "testUser",
		name: "Test User",
		avatar: "avatar.png"
	};

	const mockSession: Session = {
		id: "session1",
		authInfo: mockUser,
		createdAt: Date.now()
	};

	afterEach( () => {
		vi.clearAllMocks();
	} );

	describe( "initializeContext()", () => {
		it( "should set up the context with database and relying party info when in dev", () => {
			const ctx: any = {
				env: mockEnv,
				set: vi.fn()
			};

			initializeContext( ctx );
			expect( ctx.set ).toHaveBeenCalledWith( "db", expect.any( Object ) );
			expect( ctx.set ).toHaveBeenCalledWith( "rpId", "localhost" );
			expect( ctx.set ).toHaveBeenCalledWith( "rpOrigin", "http://localhost:5173" );
		} );

		it( "should set up the context with database and relying party info when in production", () => {
			const originalNodeEnv = process.env[ "NODE_ENV" ];
			process.env[ "NODE_ENV" ] = "production";

			const ctx: any = {
				env: mockEnv,
				set: vi.fn()
			};

			initializeContext( ctx );

			expect( ctx.set ).toHaveBeenCalledWith( "db", expect.any( Object ) );
			expect( ctx.set ).toHaveBeenCalledWith( "rpId", "stairway.yashgupta.me" );
			expect( ctx.set ).toHaveBeenCalledWith( "rpOrigin", "https://stairway.yashgupta.me" );

			process.env[ "NODE_ENV" ] = originalNodeEnv;
		} );
	} );

	describe( "POST /user/exists", () => {

		it( "should throw 400 error for invalid username", async () => {
			const response = await auth.request(
				"/user/exists",
				{ method: "POST", headers, body: JSON.stringify( { username: "ab" } ) },
				mockEnv
			);
			expect( response.status ).toBe( 400 );
		} );

		it( "should return user existence status", async () => {
			vi.mocked( userExists ).mockResolvedValue( true );

			const response = await auth.request(
				"/user/exists",
				{ method: "POST", headers, body: JSON.stringify( { username: "abc123" } ) },
				mockEnv
			);

			const data = await response.json();
			expect( data ).toEqual( { exists: true } );
			expect( userExists ).toHaveBeenCalledWith( "abc123", expect.objectContaining( { env: mockEnv } ) );
		} );

	} );

	describe( "GET /info", () => {

		it( "should return null when not authenticated", async () => {
			vi.mocked( validateSession ).mockResolvedValue( undefined );

			const response = await auth.request( "/info", {}, mockEnv );
			const data = await response.json();

			expect( data ).toEqual( { authInfo: null } );
			expect( validateSession ).toHaveBeenCalledWith( expect.objectContaining( { env: mockEnv } ) );
		} );

		it( "should return authentication information", async () => {
			vi.mocked( validateSession ).mockResolvedValue( mockSession );

			const response = await auth.request( "/info", {}, mockEnv );
			const data = await response.json();

			expect( data ).toEqual( { authInfo: mockUser } );
			expect( validateSession ).toHaveBeenCalledWith( expect.objectContaining( { env: mockEnv } ) );
		} );

	} );

	describe( "DELETE /logout", () => {

		it( "should return 401 if no valid session found", async () => {
			vi.mocked( validateSession ).mockResolvedValue( undefined );

			const response = await auth.request( "/logout", { method: "DELETE" }, mockEnv );

			expect( response.status ).toBe( 401 );
			expect( validateSession ).toHaveBeenCalledWith( expect.objectContaining( { env: mockEnv } ) );
		} );

		it( "should log out the user", async () => {
			vi.mocked( validateSession ).mockResolvedValue( mockSession );

			const response = await auth.request( "/logout", { method: "DELETE" }, mockEnv );

			expect( response.status ).toBe( 204 );
			expect( validateSession ).toHaveBeenCalledWith( expect.objectContaining( { env: mockEnv } ) );
			expect( deleteSession ).toHaveBeenCalledWith( mockSession.id, expect.objectContaining( { env: mockEnv } ) );
		} );

	} );

	describe( "POST /registration/options", () => {

		it( "should throw 400 error for invalid input", async () => {
			const response = await auth.request(
				"/registration/options",
				{ method: "POST", headers, body: JSON.stringify( { username: "ab", name: "Nu" } ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
		} );

		it( "should return registration options", async () => {
			vi.mocked( getRegisterOptions ).mockResolvedValue( { challenge: "challengeData" } as any );

			const response = await auth.request(
				"/registration/options",
				{ method: "POST", headers, body: JSON.stringify( { username: "newUser", name: "New User" } ) },
				mockEnv
			);

			const data = await response.json();

			expect( data ).toEqual( { challenge: "challengeData" } );
			expect( getRegisterOptions ).toHaveBeenCalledWith(
				{ username: "newUser", name: "New User" },
				expect.objectContaining( { env: mockEnv } )
			);
		} );

	} );

	describe( "POST /registration/verify", () => {

		it( "should throw 400 error for invalid input", async () => {
			const response = await auth.request(
				"/registration/verify",
				{ method: "POST", headers, body: JSON.stringify( { username: "ab", name: "Nu", response: {} } ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
		} );

		it( "should verify registration data and create session", async () => {
			vi.mocked( verifyRegistration ).mockResolvedValue( mockUser );

			const response = await auth.request(
				"/registration/verify",
				{
					method: "POST",
					headers,
					body: JSON.stringify( { username: "newUser", name: "New User", response: {} } )
				},
				mockEnv
			);

			expect( response.status ).toBe( 204 );
			expect( verifyRegistration ).toHaveBeenCalledWith(
				{ username: "newUser", name: "New User", response: {} },
				expect.objectContaining( { env: mockEnv } )
			);

			expect( createSession ).toHaveBeenCalledWith( mockUser, expect.objectContaining( { env: mockEnv } ) );
		} );

	} );

	describe( "POST /login/options", () => {

		it( "should throw 400 error for invalid input", async () => {
			const response = await auth.request(
				"/login/options",
				{ method: "POST", headers, body: JSON.stringify( { username: "ab" } ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
		} );

		it( "should return login options", async () => {
			vi.mocked( getLoginOptions ).mockResolvedValue( { challenge: "loginChallengeData" } as any );

			const response = await auth.request(
				"/login/options",
				{ method: "POST", headers, body: JSON.stringify( { username: "existingUser" } ) },
				mockEnv
			);

			const data = await response.json();

			expect( data ).toEqual( { challenge: "loginChallengeData" } );
			expect( getLoginOptions ).toHaveBeenCalledWith(
				{ username: "existingUser" },
				expect.objectContaining( { env: mockEnv } )
			);
		} );

	} );

	describe( "POST /login/verify", () => {

		it( "should throw 400 error for invalid input", async () => {
			const response = await auth.request(
				"/login/verify",
				{ method: "POST", headers, body: JSON.stringify( { username: "ab", response: {} } ) },
				mockEnv
			);

			expect( response.status ).toBe( 400 );
		} );

		it( "should verify login data and create session", async () => {
			vi.mocked( verifyLogin ).mockResolvedValue( mockUser );

			const response = await auth.request(
				"/login/verify",
				{ method: "POST", headers, body: JSON.stringify( { username: "existingUser", response: {} } ) },
				mockEnv
			);

			expect( response.status ).toBe( 204 );
			expect( verifyLogin ).toHaveBeenCalledWith(
				{ username: "existingUser", response: {} },
				expect.objectContaining( { env: mockEnv } )
			);

			expect( createSession ).toHaveBeenCalledWith( mockUser, expect.objectContaining( { env: mockEnv } ) );
		} );

	} );
} );