import { isoBase64URL } from "@simplewebauthn/server/helpers";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiSecurity from "effect/unstable/httpapi/HttpApiSecurity";
import * as Context from "effect/Context";
import type * as Alchemy from "alchemy";
import * as Layer from "effect/Layer";

import type { AuthInfo } from "@/auth/shared/schema.ts";

/** Cookie name carrying the opaque session token. */
export const SESSION_COOKIE = "stairway_session";

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * The cookie descriptor `securitySetCookie` writes to. We don't use it as an
 * endpoint security scheme (the middleware reads the cookie itself) — it just
 * names the cookie and lets a typed handler set it via a pre-response handler.
 */
const SessionSecurity = HttpApiSecurity.apiKey( { in: "cookie", key: SESSION_COOKIE } );

const cookieOptions = {
	secure: true,
	httpOnly: true,
	// api and web are different origins, so the session cookie must be
	// cross-site; `SameSite=None` requires `Secure`.
	sameSite: "none",
	path: "/"
} as const;

/**
 * Server-side sessions: opaque token -> encoded `AuthInfo`, with a rolling TTL.
 */
export class SessionStore extends Context.Service<SessionStore, {
	readonly get: ( key: string ) => Effect.Effect<AuthInfo | null, never, Alchemy.RuntimeContext>;

	readonly set: ( key: string, value: AuthInfo ) =>
		Effect.Effect<void, never, Alchemy.RuntimeContext>;

	readonly delete: ( key: string ) => Effect.Effect<void, never, Alchemy.RuntimeContext>;
}>()( "stairway/SessionStore" ) {}


type SessionServiceDeps = Alchemy.RuntimeContext | HttpServerRequest.HttpServerRequest;

/**
 * Session Service to capture session logic
 */
export class SessionService extends Context.Service<SessionService, {

	/** Mint a session for `user`: persist it in KV and set the cookie. */
	readonly issue: ( authInfo: AuthInfo ) => Effect.Effect<void, never, SessionServiceDeps>;

	/** Resolve the current request's session, or `null` if none / expired. */
	readonly load: () => Effect.Effect<AuthInfo | null, never, SessionServiceDeps>;

	/** Drop the current session from KV and expire the cookie. */
	readonly clear: () => Effect.Effect<void, never, SessionServiceDeps>;
}>()( "auth/SessionService" ) {}

export const SessionServiceLive = Layer.effect(
	SessionService,
	Effect.gen( function* () {
		const store = yield* SessionStore;
		return SessionService.of( {
			issue: Effect.fn( function* ( authInfo: AuthInfo ) {
				const token = isoBase64URL.fromBuffer( crypto.getRandomValues( new Uint8Array( 32 ) ) );
				yield* store.set( token, authInfo );
				yield* HttpApiBuilder.securitySetCookie( SessionSecurity, token, {
					...cookieOptions,
					maxAge: Duration.seconds( TTL_SECONDS )
				} );
			} ),

			load: Effect.fn( function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				const token = request.cookies[ SESSION_COOKIE ];
				if ( !token ) {
					return null;
				}

				return yield* store.get( token );
			} ),

			clear: Effect.fn( function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				const token = request.cookies[ SESSION_COOKIE ];
				if ( token ) {
					yield* store.delete( token );
				}

				yield* HttpApiBuilder.securitySetCookie( SessionSecurity, "", {
					...cookieOptions,
					maxAge: Duration.zero
				} );
			} )
		} );
	} )
);
