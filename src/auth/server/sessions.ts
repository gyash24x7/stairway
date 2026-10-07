import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

import * as Base64Url from "effect/encoding/Base64Url";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiSecurity from "effect/http-api/HttpApiSecurity";
import type * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as Persistable from "effect/persistence/Persistable";
import * as Persistence from "effect/persistence/Persistence";

import { User } from "@/auth/schema";


export const SESSION_COOKIE = "stairway_session";
const TTL = Duration.days( 30 );
const cookieOptions = { secure: true, httpOnly: true, sameSite: "lax", path: "/" } as const;
const SessionSecurity = HttpApiSecurity.apiKey( { in: "cookie", key: SESSION_COOKIE } );

export class SessionEntry extends Persistable.Class<{ payload: { token: string } }>()(
	"auth/SessionEntry",
	{ primaryKey: ( { token } ) => token, success: User }
) {}


// --- Session Service ----------------------------------------------------

type SessionServiceDeps =
	| HttpServerRequest.HttpServerRequest
	| HttpServerRequest.ParsedSearchParams;

export class SessionService extends Context.Service<SessionService, {
	readonly issue: ( user: User ) => Effect.Effect<void, never, SessionServiceDeps>;
	readonly load: () => Effect.Effect<Option.Option<User>, never, SessionServiceDeps>;
	readonly clear: () => Effect.Effect<void, never, SessionServiceDeps>;
	readonly loadByToken: ( token: string ) => Effect.Effect<Option.Option<User>>;
}>()( "auth/SessionService" ) {}

export const SessionServiceLive = Layer.effect(
	SessionService,
	Effect.gen( function* () {
		const crypto = yield* Crypto.Crypto;
		const persistence = yield* Persistence.Persistence;
		const store = yield* persistence.make( { storeId: "sessions", timeToLive: () => TTL } );

		const readToken = HttpApiBuilder.securityDecode( SessionSecurity ).pipe(
			Effect.map( cookie => {
				const token = Redacted.value( cookie );
				return token === "" ? Option.none<string>() : Option.some( token );
			} )
		);

		const loadByToken = Effect.fn( function* ( token: string ) {
			if ( token === "" ) {
				return Option.none<User>();
			}

			const entry = new SessionEntry( { token } );
			const result = yield* store.get( entry ).pipe( Effect.orDie );

			return result && Exit.isSuccess( result )
				? Option.some( result.value )
				: Option.none<User>();
		} );

		return SessionService.of( {
			loadByToken,

			issue: Effect.fn( function* ( authInfo: User ) {
				const bytes = yield* crypto.randomBytes( 32 ).pipe( Effect.orDie );
				const token = Base64Url.encode( bytes );

				const entry = new SessionEntry( { token } );
				yield* store.set( entry, Exit.succeed( authInfo ) ).pipe( Effect.orDie );

				const options = { ...cookieOptions, maxAge: TTL };
				yield* HttpApiBuilder.securitySetCookie( SessionSecurity, token, options );
			} ),

			load: Effect.fn( function* () {
				const token = yield* readToken;
				return Option.isNone( token )
					? Option.none<User>()
					: yield* loadByToken( token.value );
			} ),

			clear: Effect.fn( function* () {
				const token = yield* readToken;
				if ( Option.isSome( token ) ) {
					const entry = new SessionEntry( { token: token.value } );
					yield* store.remove( entry ).pipe( Effect.orDie );
				}

				const options = { ...cookieOptions, maxAge: Duration.zero };
				yield* HttpApiBuilder.securitySetCookie( SessionSecurity, "", options );
			} )
		} );
	} )
);
