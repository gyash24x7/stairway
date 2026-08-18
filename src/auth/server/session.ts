import { isoBase64URL } from "@simplewebauthn/server/helpers";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpServerRequest } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiSecurity } from "effect/unstable/httpapi";

import type { AuthInfo } from "@/auth/shared/schema.ts";

export const SESSION_COOKIE = "stairway_session";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const cookieOptions = { secure: true, httpOnly: true, sameSite: "none", path: "/" } as const;
const SessionSecurity = HttpApiSecurity.apiKey( { in: "cookie", key: SESSION_COOKIE } );
type SessionServiceDeps = HttpServerRequest.HttpServerRequest;


// --- Session Store ----------------------------------------------------

export class SessionStore extends Context.Service<SessionStore, {
	readonly get: ( key: string ) => Effect.Effect<AuthInfo | null>;
	readonly set: ( key: string, value: AuthInfo ) => Effect.Effect<void>;
	readonly delete: ( key: string ) => Effect.Effect<void>;
}>()( "auth/SessionStore" ) {}


// --- Session Service ----------------------------------------------------

export class SessionService extends Context.Service<SessionService, {
	readonly issue: ( authInfo: AuthInfo ) => Effect.Effect<void, never, SessionServiceDeps>;
	readonly load: () => Effect.Effect<AuthInfo | null, never, SessionServiceDeps>;
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
