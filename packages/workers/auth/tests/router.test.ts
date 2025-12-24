import { call } from "@orpc/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { undefined } from "valibot";
import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "../src/router.ts";
import {
	checkIfUserExists,
	getLoginOptions,
	getRegisterOptions,
	verifyLogin,
	verifyRegistration
} from "../src/service.ts";
import { createSession, deleteSession, validateSession } from "../src/sessions.ts";
import type { AuthInfo, Context, Session } from "../src/types.ts";

vi.mock( "../src/service.ts", () => ( {
	getRegisterOptions: vi.fn(),
	getLoginOptions: vi.fn(),
	checkIfUserExists: vi.fn(),
	verifyRegistration: vi.fn(),
	verifyLogin: vi.fn()
} ) );

vi.mock( "../src/sessions.ts", () => ( {
	createSession: vi.fn(),
	deleteSession: vi.fn(),
	validateSession: vi.fn()
} ) );

describe( "Auth:Router", () => {

	const mockCtx: Context = { env: {} } as unknown as Context;

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

	describe( "POST /user/exists", () => {

		it( "should throw BAD_REQUEST error for invalid username", async () => {
			expect.assertions( 1 );
			await call( auth.userExists, { username: "ab" }, { context: mockCtx } ).catch( ( error ) => {
				expect( error ).toBeDefined();
			} );
		} );

		it( "should return user existence status and initialize context for production", async () => {
			process.env[ "NODE_ENV" ] = "production";
			vi.mocked( checkIfUserExists ).mockResolvedValue( true );
			const data = await call( auth.userExists, { username: "abc123" }, { context: mockCtx } );
			expect( data ).toEqual( { exists: true } );
			expect( checkIfUserExists ).toHaveBeenCalledWith( "abc123", expect.any( Object ) );
		} );

	} );

	describe( "GET /info", () => {

		it( "should return null when not authenticated", async () => {
			const data = await call( auth.authInfo, undefined, { context: mockCtx } );
			expect( data ).toEqual( { authInfo: null } );
			expect( validateSession ).toHaveBeenCalledWith( expect.any( Object ), mockCtx.reqHeaders );
		} );

		it( "should return authentication information", async () => {
			vi.mocked( validateSession ).mockResolvedValue( mockSession );
			const data = await call( auth.authInfo, undefined, { context: mockCtx } );
			expect( data ).toEqual( { authInfo: mockUser } );
			expect( validateSession ).toHaveBeenCalledWith( expect.any( Object ), mockCtx.reqHeaders );
		} );

	} );

	describe( "DELETE /logout", () => {

		it( "should return UNAUTHORIZED if no valid session found", async () => {
			vi.mocked( validateSession ).mockResolvedValue( null as any );
			expect.assertions( 2 );
			await call( auth.logout, undefined, { context: mockCtx } ).catch( ( error ) => {
				expect( error ).toBeDefined();
				expect( validateSession ).toHaveBeenCalledWith( expect.any( Object ), mockCtx.reqHeaders );
			} );
		} );

		it( "should log out the user", async () => {
			vi.mocked( validateSession ).mockResolvedValue( mockSession );
			await call( auth.logout, undefined, { context: mockCtx } );
			expect( validateSession ).toHaveBeenCalledWith( expect.any( Object ), mockCtx.reqHeaders );
			expect( deleteSession ).toHaveBeenCalledWith( mockSession.id, expect.any( Object ), mockCtx.resHeaders );
		} );

	} );

	describe( "POST /registration/options", () => {

		it( "should throw BAD_REQUEST error for invalid input", async () => {
			expect.assertions( 1 );
			await call( auth.registrationOptions, { username: "ab", name: "Nu" }, { context: mockCtx } )
				.catch( ( error ) => {
					expect( error ).toBeDefined();
				} );
		} );

		it( "should return registration options", async () => {
			vi.mocked( getRegisterOptions ).mockResolvedValue( { challenge: "challengeData" } as any );
			const input = { username: "newUser", name: "New User" };
			const data = await call( auth.registrationOptions, input, { context: mockCtx } );
			expect( data ).toEqual( { challenge: "challengeData" } );
			expect( getRegisterOptions ).toHaveBeenCalledWith( input, expect.any( Object ) );
		} );

	} );

	describe( "POST /registration/verify", () => {

		it( "should throw BAD_REQUEST error for invalid input", async () => {
			const input = { username: "ab", name: "Nu", response: {} as RegistrationResponseJSON };
			expect.assertions( 1 );
			await call( auth.verifyRegistration, input, { context: mockCtx } ).catch( ( error ) => {
				expect( error ).toBeDefined();
			} );
		} );

		it( "should verify registration data and create session", async () => {
			vi.mocked( verifyRegistration ).mockResolvedValue( mockUser );
			const input = { username: "newUser", name: "New User", response: {} as RegistrationResponseJSON };
			await call( auth.verifyRegistration, input, { context: mockCtx } );
			expect( verifyRegistration ).toHaveBeenCalledWith( input, expect.any( Object ) );
			expect( createSession ).toHaveBeenCalledWith( mockUser, expect.any( Object ), mockCtx.resHeaders );
		} );

	} );

	describe( "POST /login/options", () => {

		it( "should throw BAD_REQUEST error for invalid input", async () => {
			expect.assertions( 1 );
			await call( auth.loginOptions, { username: "ab" }, { context: mockCtx } ).catch( ( error ) => {
				expect( error ).toBeDefined();
			} );
		} );

		it( "should return login options", async () => {
			vi.mocked( getLoginOptions ).mockResolvedValue( { challenge: "loginChallengeData" } as any );
			const data = await call( auth.loginOptions, { username: "existingUser" }, { context: mockCtx } );
			expect( data ).toEqual( { challenge: "loginChallengeData" } );
			expect( getLoginOptions ).toHaveBeenCalledWith( { username: "existingUser" }, expect.any( Object ) );
		} );

	} );

	describe( "POST /login/verify", () => {

		it( "should throw BAD_REQUEST error for invalid input", async () => {
			const input = { username: "ab", response: {} as AuthenticationResponseJSON };
			expect.assertions( 1 );
			await call( auth.verifyLogin, input, { context: mockCtx } ).catch( ( error ) => {
				expect( error ).toBeDefined();
			} );
		} );

		it( "should verify login data and create session", async () => {
			vi.mocked( verifyLogin ).mockResolvedValue( mockUser );
			const input = { username: "existingUser", response: {} as AuthenticationResponseJSON };
			await call( auth.verifyLogin, input, { context: mockCtx } );
			expect( verifyLogin ).toHaveBeenCalledWith( input, expect.any( Object ) );
			expect( createSession ).toHaveBeenCalledWith( mockUser, expect.any( Object ), mockCtx.resHeaders );
		} );

	} );
} );