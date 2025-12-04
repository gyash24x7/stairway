import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockClear, mockDeep } from "vitest-mock-extended";
import { createSession, deleteSession, validateSession } from "../src/sessions.ts";
import type { AuthInfo, HonoCtx } from "../src/types.ts";

vi.mock( "hono/cookie", () => ( {
	setSignedCookie: vi.fn(),
	getSignedCookie: vi.fn(),
	deleteCookie: vi.fn()
} ) );

describe( "Auth:Sessions", () => {

	const mockCtx = {
		env: {
			SESSION_KV: mockDeep<KVNamespace>(),
			AUTH_SECRET_KEY: "auth_secret_key"
		}
	} as unknown as HonoCtx;

	const mockAuthInfo: AuthInfo = {
		id: "user123",
		name: "Test User",
		username: "testUser",
		avatar: "avatar.png"
	};

	afterEach( () => {
		mockClear( mockCtx.env.SESSION_KV );
		vi.clearAllMocks();
	} );

	describe( "createSession()", () => {
		it( "should create a new session", async () => {
			await createSession( mockAuthInfo, mockCtx );
			expect( mockCtx.env.SESSION_KV.put ).toHaveBeenCalledWith(
				expect.any( String ),
				expect.stringContaining( JSON.stringify( mockAuthInfo ) ),
				{ expirationTtl: 604800 }
			);

			expect( vi.mocked( setSignedCookie ) ).toHaveBeenCalledWith(
				mockCtx,
				"auth_session",
				expect.any( String ),
				"auth_secret_key",
				expect.any( Object )
			);
		} );
	} );

	describe( "deleteSession()", () => {
		it( "should delete an existing session", async () => {
			const sessionId = "session123";
			await deleteSession( sessionId, mockCtx );
			expect( mockCtx.env.SESSION_KV.delete ).toHaveBeenCalledWith( sessionId );
			expect( vi.mocked( deleteCookie ) ).toHaveBeenCalledWith( mockCtx, "auth_session", expect.any( Object ) );
		} );
	} );

	describe( "validateSession()", () => {
		it( "should return valid session", async () => {
			const validSession = {
				id: "session123",
				authInfo: mockAuthInfo,
				createdAt: Date.now()
			};

			vi.mocked( getSignedCookie ).mockResolvedValue( "session123" );
			vi.mocked( mockCtx.env.SESSION_KV.get ).mockResolvedValue( validSession as any );

			const session = await validateSession( mockCtx );
			expect( session ).toEqual( validSession );
			expect( vi.mocked( getSignedCookie ) ).toHaveBeenCalledWith( mockCtx, "auth_secret_key", "auth_session" );
			expect( mockCtx.env.SESSION_KV.get ).toHaveBeenCalledWith( "session123", { type: "json" } );
		} );

		it( "should return undefined when no session id", async () => {
			vi.mocked( getSignedCookie ).mockResolvedValue( undefined );
			const session = await validateSession( mockCtx );
			expect( session ).toBeUndefined();
			expect( vi.mocked( getSignedCookie ) ).toHaveBeenCalledWith( mockCtx, "auth_secret_key", "auth_session" );
		} );

		it( "should return undefined when no session found", async () => {
			vi.mocked( getSignedCookie ).mockResolvedValue( "invalid_session_id" );
			vi.mocked( mockCtx.env.SESSION_KV.get ).mockResolvedValue( null as any );

			const session = await validateSession( mockCtx );
			expect( session ).toBeUndefined();
			expect( vi.mocked( getSignedCookie ) ).toHaveBeenCalledWith( mockCtx, "auth_secret_key", "auth_session" );
			expect( mockCtx.env.SESSION_KV.get ).toHaveBeenCalledWith( "invalid_session_id", { type: "json" } );
		} );

		it( "should return undefined when session expired", async () => {
			const expiredSession = {
				id: "session123",
				authInfo: mockAuthInfo,
				createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000
			};

			vi.mocked( getSignedCookie ).mockResolvedValue( "session123" );
			vi.mocked( mockCtx.env.SESSION_KV.get ).mockResolvedValue( expiredSession as any );

			const session = await validateSession( mockCtx );
			expect( session ).toBeUndefined();
			expect( vi.mocked( getSignedCookie ) ).toHaveBeenCalledWith( mockCtx, "auth_secret_key", "auth_session" );
			expect( mockCtx.env.SESSION_KV.get ).toHaveBeenCalledWith( "session123", { type: "json" } );
			expect( mockCtx.env.SESSION_KV.delete ).toHaveBeenCalledWith( "session123" );
		} );
	} );
} );