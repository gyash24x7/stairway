import {
	type AuthenticationResponseJSON,
	generateRegistrationOptions,
	type VerifiedRegistrationResponse,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import * as schema from "../src/schema.ts";
import { getLoginOptions, getRegisterOptions, userExists, verifyLogin, verifyRegistration } from "../src/service.ts";
import type {
	HonoCtx,
	LoginOptions,
	RegisterOptions,
	VerifyLoginInput,
	VerifyRegistrationInput
} from "../src/types.ts";

vi.mock( "@simplewebauthn/server", () => {
	return {
		generateRegistrationOptions: vi.fn(),
		generateAuthenticationOptions: vi.fn(),
		verifyRegistrationResponse: vi.fn(),
		verifyAuthenticationResponse: vi.fn()
	};
} );

describe( "Auth:Service", () => {

	const dbInsertReturningMock = vi.fn();
	const dbInsertValuesMock = vi.fn( () => ( { returning: dbInsertReturningMock } ) );
	const dbInsertMock = vi.fn( () => ( { values: dbInsertValuesMock } ) );

	const dbUpdateWhereMock = vi.fn();
	const dbUpdateSetMock = vi.fn( () => ( { where: dbUpdateWhereMock } ) );
	const dbUpdateMock = vi.fn( () => ( { set: dbUpdateSetMock } ) );

	const mockCtx = {
		var: {
			db: {
				query: {
					users: { findFirst: vi.fn() },
					passkeys: { findFirst: vi.fn() }
				},
				insert: dbInsertMock,
				update: dbUpdateMock
			},
			rpId: "localhost",
			rpOrigin: "http://localhost:5173"
		},
		env: { WEBAUTHN_KV: mockDeep<KVNamespace>() }
	} as unknown as HonoCtx;

	const mockUser = {
		id: "user123",
		username: "testUser",
		name: "Test User",
		avatar: "avatar.png"
	};

	afterEach( () => {
		mockClear( mockCtx.env.WEBAUTHN_KV );
		vi.clearAllMocks();
	} );

	describe( "userExists()", () => {

		it( "should return false if user doesn't exist", async () => {
			vi.mocked( mockCtx.var.db.query.users.findFirst ).mockResolvedValueOnce( undefined );
			const exists = await userExists( "nonexistentUser", mockCtx );
			expect( exists ).toBe( false );
		} );

		it( "should return true if user exists", async () => {
			vi.mocked( mockCtx.var.db.query.users.findFirst ).mockResolvedValueOnce( mockUser );
			const exists = await userExists( "testUser", mockCtx );
			expect( exists ).toBe( true );
		} );

	} );

	describe( "getRegisterOptions()", () => {

		it( "should generate registration options and store them in KV", async () => {
			const input = { username: "testUser", name: "Test User" };
			const mockOptions = { challenge: "randomChallenge", user: { id: "webauthnUserId" } };
			vi.mocked( generateRegistrationOptions ).mockResolvedValue( mockOptions as RegisterOptions );

			const options = await getRegisterOptions( input, mockCtx );

			expect( generateRegistrationOptions ).toHaveBeenCalledWith( {
				userDisplayName: input.name,
				rpID: expect.any( String ),
				rpName: "stairway",
				userName: input.username,
				attestationType: "none",
				authenticatorSelection: {
					residentKey: "preferred",
					userVerification: "preferred"
				}
			} );

			expect( mockCtx.env.WEBAUTHN_KV.put ).toHaveBeenCalledWith(
				input.username,
				JSON.stringify( { challenge: mockOptions.challenge, webauthnUserId: mockOptions.user.id } )
			);

			expect( options ).toBe( mockOptions );
		} );

	} );

	describe( "getLoginOptions()", () => {

		it( "should generate login options for existing user", async () => {
			const input = { username: "testUser" };
			vi.mocked( mockCtx.var.db.query.users.findFirst ).mockResolvedValueOnce( mockUser );

			const { generateAuthenticationOptions } = await import( "@simplewebauthn/server" );
			const mockLoginOptions = { challenge: "loginChallenge" };
			vi.mocked( generateAuthenticationOptions ).mockResolvedValueOnce( mockLoginOptions as LoginOptions );

			const options = await getLoginOptions( input, mockCtx );

			expect( mockCtx.var.db.query.users.findFirst ).toHaveBeenCalledWith( {
				where: eq( schema.users.username, input.username )
			} );

			expect( generateAuthenticationOptions ).toHaveBeenCalledWith( {
				rpID: expect.any( String ),
				userVerification: "preferred",
				allowCredentials: []
			} );

			expect( mockCtx.env.WEBAUTHN_KV.put ).toHaveBeenCalledWith(
				input.username,
				JSON.stringify( { challenge: mockLoginOptions.challenge } )
			);

			expect( options ).toBe( mockLoginOptions );
		} );

		it( "should throw error for non-existing user", async () => {
			const input = { username: "nonexistentUser" };
			vi.mocked( mockCtx.var.db.query.users.findFirst ).mockResolvedValueOnce( undefined );

			await expect( getLoginOptions( input, mockCtx ) ).rejects.toBe( "User not found" );

			expect( mockCtx.var.db.query.users.findFirst ).toHaveBeenCalledWith( {
				where: eq( schema.users.username, input.username )
			} );
		} );

	} );

	describe( "verifyRegistration()", () => {

		it( "should verify registration response", async () => {
			const input: VerifyRegistrationInput = {
				username: "testUser",
				name: "Test User",
				response: {} as any
			};

			vi.mocked( mockCtx.env.WEBAUTHN_KV.get ).mockResolvedValueOnce( JSON.stringify( {
				challenge: "randomChallenge",
				webauthnUserId: "webauthnUserId"
			} ) as any );

			vi.mocked( verifyRegistrationResponse ).mockResolvedValueOnce( {
				verified: true,
				registrationInfo: {
					credential: {
						id: "credentialId",
						publicKey: new Uint8Array( [ 1, 2, 3 ] ),
						counter: 0
					}
				}
			} as VerifiedRegistrationResponse );

			dbInsertReturningMock.mockResolvedValue( [ mockUser ] );

			const authInfo = await verifyRegistration( input, mockCtx );

			expect( mockCtx.env.WEBAUTHN_KV.get ).toHaveBeenCalledWith( input.username );
			expect( verifyRegistrationResponse ).toHaveBeenCalledWith( {
				response: input.response,
				expectedChallenge: "randomChallenge",
				expectedRPID: expect.any( String ),
				expectedOrigin: expect.any( String )
			} );

			expect( dbInsertMock ).toHaveBeenCalledWith( schema.users );
			expect( dbInsertValuesMock ).toHaveBeenCalledWith( {
				name: input.name,
				username: input.username,
				id: expect.any( String ),
				avatar: expect.any( String )
			} );

			expect( dbInsertReturningMock ).toHaveBeenCalled();
			expect( dbInsertMock ).toHaveBeenCalledWith( schema.passkeys );
			expect( dbInsertValuesMock ).toHaveBeenCalledWith( {
				id: "credentialId",
				publicKey: new Uint8Array( [ 1, 2, 3 ] ),
				userId: mockUser.id,
				counter: 0
			} );

			expect( mockCtx.env.WEBAUTHN_KV.delete ).toHaveBeenCalledWith( input.username );
			expect( authInfo ).toBe( mockUser );
		} );

		it( "should throw error if no options found in KV", async () => {
			const input: VerifyRegistrationInput = {
				username: "testUser",
				name: "Test User",
				response: {} as any
			};

			vi.mocked( mockCtx.env.WEBAUTHN_KV.get ).mockResolvedValueOnce( null as any );

			await expect( verifyRegistration( input, mockCtx ) ).rejects.toBe( "No WebAuthn options found for user" );
		} );

		it( "should throw error if verification is not verified", async () => {
			const input: VerifyRegistrationInput = {
				username: "testUser",
				name: "Test User",
				response: {} as any
			};

			vi.mocked( mockCtx.env.WEBAUTHN_KV.get ).mockResolvedValueOnce( JSON.stringify( {
				challenge: "randomChallenge",
				webauthnUserId: "webauthnUserId"
			} ) as any );

			vi.mocked( verifyRegistrationResponse ).mockResolvedValueOnce( {
				verified: false
			} as VerifiedRegistrationResponse );

			await expect( verifyRegistration( input, mockCtx ) ).rejects.toBe( "WebAuthn verification failed" );

			expect( mockCtx.env.WEBAUTHN_KV.get ).toHaveBeenCalledWith( input.username );
			expect( verifyRegistrationResponse ).toHaveBeenCalledWith( {
				response: input.response,
				expectedChallenge: "randomChallenge",
				expectedRPID: expect.any( String ),
				expectedOrigin: expect.any( String )
			} );
		} );

		it( "should throw error if registrationInfo is missing", async () => {
			const input: VerifyRegistrationInput = {
				username: "testUser",
				name: "Test User",
				response: {} as any
			};

			vi.mocked( mockCtx.env.WEBAUTHN_KV.get ).mockResolvedValueOnce( JSON.stringify( {
				challenge: "randomChallenge",
				webauthnUserId: "webauthnUserId"
			} ) as any );

			vi.mocked( verifyRegistrationResponse ).mockResolvedValueOnce( {
				verified: true
			} as VerifiedRegistrationResponse );

			await expect( verifyRegistration( input, mockCtx ) ).rejects.toBe( "WebAuthn verification failed" );

			expect( mockCtx.env.WEBAUTHN_KV.get ).toHaveBeenCalledWith( input.username );
			expect( verifyRegistrationResponse ).toHaveBeenCalledWith( {
				response: input.response,
				expectedChallenge: "randomChallenge",
				expectedRPID: expect.any( String ),
				expectedOrigin: expect.any( String )
			} );
		} );

	} );

	describe( "verifyLogin()", () => {

		it( "should throw error if no options found in kv", async () => {
			const input: VerifyLoginInput = {
				username: "testUser",
				response: {} as AuthenticationResponseJSON
			};

			vi.mocked( mockCtx.env.WEBAUTHN_KV.get ).mockResolvedValueOnce( null as any );

			await expect( verifyLogin( input, mockCtx ) ).rejects.toBe( "No WebAuthn options found for user" );

			expect( mockCtx.env.WEBAUTHN_KV.get ).toHaveBeenCalledWith( input.username );
		} );

		it( "should throw error if user not found", async () => {
			const input: VerifyLoginInput = {
				username: "testUser",
				response: {} as AuthenticationResponseJSON
			};

			vi.mocked( mockCtx.env.WEBAUTHN_KV.get ).mockResolvedValueOnce( JSON.stringify( {
				challenge: "loginChallenge"
			} ) as any );

			vi.mocked( mockCtx.var.db.query.users.findFirst ).mockResolvedValueOnce( undefined );

			await expect( verifyLogin( input, mockCtx ) ).rejects.toBe( "User not found" );

			expect( mockCtx.env.WEBAUTHN_KV.get ).toHaveBeenCalledWith( input.username );
			expect( mockCtx.var.db.query.users.findFirst ).toHaveBeenCalledWith( {
				where: eq( schema.users.username, input.username )
			} );
		} );

		it( "should throw error if no passkeys found for user", async () => {
			const input: VerifyLoginInput = {
				username: "testUser",
				response: {} as AuthenticationResponseJSON
			};

			vi.mocked( mockCtx.env.WEBAUTHN_KV.get ).mockResolvedValueOnce( JSON.stringify( {
				challenge: "loginChallenge"
			} ) as any );

			vi.mocked( mockCtx.var.db.query.users.findFirst ).mockResolvedValueOnce( mockUser );
			vi.mocked( mockCtx.var.db.query.passkeys.findFirst ).mockResolvedValueOnce( undefined );

			await expect( verifyLogin( input, mockCtx ) ).rejects.toBe( "Passkey not found for user" );

			expect( mockCtx.env.WEBAUTHN_KV.get ).toHaveBeenCalledWith( input.username );
			expect( mockCtx.var.db.query.users.findFirst ).toHaveBeenCalledWith( {
				where: eq( schema.users.username, input.username )
			} );

			expect( mockCtx.var.db.query.passkeys.findFirst ).toHaveBeenCalledWith( {
				where: and(
					eq( schema.passkeys.id, input.response.id ),
					eq( schema.passkeys.userId, mockUser.id )
				)
			} );
		} );

		it( "should throw error when verification is not verified", async () => {
			const input: VerifyLoginInput = {
				username: "testUser",
				response: {} as AuthenticationResponseJSON
			};

			vi.mocked( mockCtx.env.WEBAUTHN_KV.get ).mockResolvedValueOnce( JSON.stringify( {
				challenge: "loginChallenge"
			} ) as any );

			vi.mocked( mockCtx.var.db.query.users.findFirst ).mockResolvedValueOnce( mockUser );
			vi.mocked( mockCtx.var.db.query.passkeys.findFirst ).mockResolvedValueOnce( {
				id: "credentialId",
				publicKey: new Uint8Array( [ 1, 2, 3 ] ),
				counter: 0,
				userId: mockUser.id
			} );

			vi.mocked( verifyAuthenticationResponse ).mockResolvedValueOnce( {
				verified: false
			} as any );

			await expect( verifyLogin( input, mockCtx ) ).rejects.toBe( "WebAuthn authentication verification failed" );

			expect( mockCtx.env.WEBAUTHN_KV.get ).toHaveBeenCalledWith( input.username );
			expect( mockCtx.var.db.query.users.findFirst ).toHaveBeenCalledWith( {
				where: eq( schema.users.username, input.username )
			} );

			expect( mockCtx.var.db.query.passkeys.findFirst ).toHaveBeenCalledWith( {
				where: and(
					eq( schema.passkeys.id, input.response.id ),
					eq( schema.passkeys.userId, mockUser.id )
				)
			} );

			expect( verifyAuthenticationResponse ).toHaveBeenCalledWith( {
				response: input.response,
				expectedChallenge: "loginChallenge",
				expectedOrigin: expect.any( String ),
				expectedRPID: expect.any( String ),
				credential: {
					id: "credentialId",
					publicKey: new Uint8Array( [ 1, 2, 3 ] ),
					counter: 0
				}
			} );
		} );

		it( "should throw error when authentication info is missing", async () => {
			const input: VerifyLoginInput = {
				username: "testUser",
				response: {} as AuthenticationResponseJSON
			};

			vi.mocked( mockCtx.env.WEBAUTHN_KV.get ).mockResolvedValueOnce( JSON.stringify( {
				challenge: "loginChallenge"
			} ) as any );

			vi.mocked( mockCtx.var.db.query.users.findFirst ).mockResolvedValueOnce( mockUser );
			vi.mocked( mockCtx.var.db.query.passkeys.findFirst ).mockResolvedValueOnce( {
				id: "credentialId",
				publicKey: new Uint8Array( [ 1, 2, 3 ] ),
				counter: 0,
				userId: mockUser.id
			} );

			vi.mocked( verifyAuthenticationResponse ).mockResolvedValueOnce( {
				verified: true
			} as any );

			await expect( verifyLogin( input, mockCtx ) ).rejects.toBe( "WebAuthn authentication verification failed" );

			expect( mockCtx.env.WEBAUTHN_KV.get ).toHaveBeenCalledWith( input.username );
			expect( mockCtx.var.db.query.users.findFirst ).toHaveBeenCalledWith( {
				where: eq( schema.users.username, input.username )
			} );

			expect( mockCtx.var.db.query.passkeys.findFirst ).toHaveBeenCalledWith( {
				where: and(
					eq( schema.passkeys.id, input.response.id ),
					eq( schema.passkeys.userId, mockUser.id )
				)
			} );

			expect( verifyAuthenticationResponse ).toHaveBeenCalledWith( {
				response: input.response,
				expectedChallenge: "loginChallenge",
				expectedOrigin: expect.any( String ),
				expectedRPID: expect.any( String ),
				credential: {
					id: "credentialId",
					publicKey: new Uint8Array( [ 1, 2, 3 ] ),
					counter: 0
				}
			} );
		} );

		it( "should verify the authentication response", async () => {
			const input: VerifyLoginInput = {
				username: "testUser",
				response: {} as AuthenticationResponseJSON
			};

			vi.mocked( mockCtx.env.WEBAUTHN_KV.get ).mockResolvedValueOnce( JSON.stringify( {
				challenge: "loginChallenge"
			} ) as any );

			vi.mocked( mockCtx.var.db.query.users.findFirst ).mockResolvedValueOnce( mockUser );
			vi.mocked( mockCtx.var.db.query.passkeys.findFirst ).mockResolvedValueOnce( {
				id: "credentialId",
				publicKey: new Uint8Array( [ 1, 2, 3 ] ),
				counter: 0,
				userId: mockUser.id
			} );

			vi.mocked( verifyAuthenticationResponse ).mockResolvedValueOnce( {
				verified: true,
				authenticationInfo: {
					newCounter: 1
				}
			} as any );

			const authInfo = await verifyLogin( input, mockCtx );

			expect( authInfo ).toBe( mockUser );

			expect( mockCtx.env.WEBAUTHN_KV.get ).toHaveBeenCalledWith( input.username );
			expect( mockCtx.var.db.query.users.findFirst ).toHaveBeenCalledWith( {
				where: eq( schema.users.username, input.username )
			} );

			expect( mockCtx.var.db.query.passkeys.findFirst ).toHaveBeenCalledWith( {
				where: and(
					eq( schema.passkeys.id, input.response.id ),
					eq( schema.passkeys.userId, mockUser.id )
				)
			} );

			expect( verifyAuthenticationResponse ).toHaveBeenCalledWith( {
				response: input.response,
				expectedChallenge: "loginChallenge",
				expectedOrigin: expect.any( String ),
				expectedRPID: expect.any( String ),
				credential: {
					id: "credentialId",
					publicKey: new Uint8Array( [ 1, 2, 3 ] ),
					counter: 0
				}
			} );

			expect( dbUpdateMock ).toHaveBeenCalledWith( schema.passkeys );
			expect( dbUpdateSetMock ).toHaveBeenCalledWith( { counter: 1 } );
			expect( dbUpdateWhereMock ).toHaveBeenCalledWith( eq( schema.passkeys.id, "credentialId" ) );
			expect( mockCtx.env.WEBAUTHN_KV.delete ).toHaveBeenCalledWith( input.username );
		} );
	} );

} );