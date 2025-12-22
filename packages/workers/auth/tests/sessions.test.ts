import { deleteCookie, getCookie, setCookie, sign, unsign } from "@orpc/server/helpers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSession, deleteSession, validateSession } from "../src/sessions.ts";
import type { AuthInfo, Context } from "../src/types.ts";

vi.mock( "@orpc/server/helpers", () => ( {
	setCookie: vi.fn(),
	getCookie: vi.fn(),
	deleteCookie: vi.fn(),
	sign: vi.fn(),
	unsign: vi.fn()
} ) );

describe( "Auth:Sessions", () => {

	const mockEnv = {
		DB: {},
		WEBAUTHN_KV: {},
		SESSION_KV: {
			put: vi.fn(),
			get: vi.fn(),
			delete: vi.fn()
		},
		AUTH_SECRET: "AUTH_SECRET"
	};

	const mockCtx = {
		rpId: "",
		rpOrigin: "",
		env: mockEnv,
		reqHeaders: new Headers(),
		resHeaders: new Headers()
	} as unknown as Context;

	const mockAuthInfo: AuthInfo = {
		id: "user123",
		name: "Test User",
		username: "testUser",
		avatar: "avatar.png"
	};

	afterEach( () => {
		vi.clearAllMocks();
	} );

	describe( "createSession()", () => {
		it( "should create a new session", async () => {
			vi.mocked( sign ).mockResolvedValue( "signed_session_id" );
			await createSession( mockAuthInfo, mockCtx.env );
			expect( mockEnv.SESSION_KV.put ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.stringContaining( JSON.stringify( mockAuthInfo ) ),
				{ expirationTtl: 604800 }
			);

			expect( vi.mocked( sign ) ).toHaveBeenCalledWith( expect.any( String ), "AUTH_SECRET" );
			expect( vi.mocked( setCookie ) ).toHaveBeenCalledWith(
				mockCtx.resHeaders,
				"auth_session",
				"signed_session_id",
				expect.any( Object )
			);
		} );
	} );

	describe( "deleteSession()", () => {
		it( "should delete an existing session", async () => {
			const sessionId = "session123";
			await deleteSession( sessionId, mockCtx.env );
			expect( mockEnv.SESSION_KV.delete ).toHaveBeenCalledWith( sessionId );
			expect( vi.mocked( deleteCookie ) )
				.toHaveBeenCalledWith( mockCtx.resHeaders, "auth_session", expect.any( Object ) );
		} );
	} );

	describe( "validateSession()", () => {
		it( "should return valid session", async () => {
			const validSession = {
				id: "session123",
				authInfo: mockAuthInfo,
				createdAt: Date.now()
			};

			vi.mocked( getCookie ).mockReturnValue( "signed_session_id" );
			vi.mocked( unsign ).mockResolvedValue( "session123" );
			vi.mocked( mockEnv.SESSION_KV.get ).mockResolvedValue( validSession as any );

			const session = await validateSession( mockCtx.env, mockCtx.reqHeaders );
			expect( session ).toEqual( validSession );
			expect( vi.mocked( getCookie ) ).toHaveBeenCalledWith( mockCtx.reqHeaders, "auth_session" );
			expect( vi.mocked( unsign ) ).toHaveBeenCalledWith( "signed_session_id", "AUTH_SECRET" );
			expect( mockEnv.SESSION_KV.get ).toHaveBeenCalledWith( "session123", { type: "json" } );
		} );

		it( "should return undefined when no session id", async () => {
			vi.mocked( getCookie ).mockReturnValue( "" );
			const session = await validateSession( mockCtx.env, mockCtx.reqHeaders );
			expect( session ).toBeUndefined();
			expect( vi.mocked( getCookie ) ).toHaveBeenCalledWith( mockCtx.reqHeaders, "auth_session" );
		} );

		it( "should returnn undefined when invalid session id", async () => {
			vi.mocked( getCookie ).mockReturnValue( "signed_session_id" );
			vi.mocked( unsign ).mockResolvedValue( "" );
			const session = await validateSession( mockCtx.env, mockCtx.reqHeaders );
			expect( session ).toBeUndefined();
			expect( vi.mocked( getCookie ) ).toHaveBeenCalledWith( mockCtx.reqHeaders, "auth_session" );
			expect( vi.mocked( unsign ) ).toHaveBeenCalledWith( "signed_session_id", "AUTH_SECRET" );
		} );

		it( "should return undefined when no session found", async () => {
			vi.mocked( getCookie ).mockReturnValue( "signed_session_id" );
			vi.mocked( unsign ).mockResolvedValue( "invalid_session_id" );
			vi.mocked( mockEnv.SESSION_KV.get ).mockResolvedValue( null as any );

			const session = await validateSession( mockCtx.env, mockCtx.reqHeaders );
			expect( session ).toBeUndefined();
			expect( vi.mocked( getCookie ) ).toHaveBeenCalledWith( mockCtx.reqHeaders, "auth_session" );
			expect( vi.mocked( unsign ) ).toHaveBeenCalledWith( "signed_session_id", "AUTH_SECRET" );
			expect( mockEnv.SESSION_KV.get ).toHaveBeenCalledWith( "invalid_session_id", { type: "json" } );
		} );

		it( "should return undefined when session expired", async () => {
			const expiredSession = {
				id: "session123",
				authInfo: mockAuthInfo,
				createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000
			};

			vi.mocked( getCookie ).mockReturnValue( "signed_session_id" );
			vi.mocked( unsign ).mockResolvedValue( "session123" );
			vi.mocked( mockEnv.SESSION_KV.get ).mockResolvedValue( expiredSession as any );

			const session = await validateSession( mockCtx.env, mockCtx.reqHeaders );
			expect( session ).toBeUndefined();
			expect( vi.mocked( getCookie ) ).toHaveBeenCalledWith( mockCtx.reqHeaders, "auth_session" );
			expect( vi.mocked( unsign ) ).toHaveBeenCalledWith( "signed_session_id", "AUTH_SECRET" );
			expect( mockEnv.SESSION_KV.get ).toHaveBeenCalledWith( "session123", { type: "json" } );
			expect( mockEnv.SESSION_KV.delete ).toHaveBeenCalledWith( "session123" );
		} );
	} );
} );