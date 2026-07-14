// Server-only handler implementations for the auth HttpApi group + its per-request
// context.
//
// `AuthApiLive` is built against the merged `StairwayAPI` (so the group is keyed by
// the root api id), exactly like the game Lives in `./handlers`. It ports the seven
// WebAuthn/session flows from the pre-trim `@s2h/auth/http` — same DB +
// `@simplewebauthn/server` calls — expressed as Effect handlers that read
// `AuthHttpContext` for the request URL, cookie header, resolved user, and the
// `Set-Cookie` collector.
//
// `AuthHttpContextLive` is a GLOBAL `HttpRouter.middleware` that runs per request:
// it reads the incoming `HttpServerRequest`, resolves the user via `loadSession`,
// provides a fresh `AuthHttpContext` to the handler, and — after the handler
// produces its response — drains the collected `Set-Cookie` values onto it.
//
// Imported only by `./worker` — NOT by `./api`/`./client`, so the browser client
// never sees this server-only graph.

import { AuthHttpContext } from "@s2h/auth/context";
import { createSession, destroySession, loadSession } from "@s2h/auth/sessions";
import { db } from "@s2h/db";
import { passkeys, users, webauthnOptions } from "@s2h/db/schema";
import { generateAvatar, generateId } from "@s2h/utils/generator";
import {
	type AuthenticationResponseJSON,
	generateAuthenticationOptions,
	generateRegistrationOptions,
	type RegistrationResponseJSON,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";
import { StairwayAPI } from "./api";

const getUserByUsername = ( username: string ) =>
	db.query.users.findFirst( { where: eq( users.username, username ) } );

const getWebAuthnOptions = ( username: string ) =>
	db.query.webauthnOptions.findFirst( { where: eq( webauthnOptions.username, username ) } );

// --- Handlers (residual requirement: `AuthHttpContext`) --------------------

export const AuthApiLive = HttpApiBuilder.group( StairwayAPI, "auth", ( handlers ) =>
	handlers
		.handle( "me", () => Effect.map( AuthHttpContext, ( context ) => context.user ) )
		.handle( "checkIfUserExists", ( { payload } ) =>
			Effect.map(
				Effect.promise( () => getUserByUsername( payload.username ) ),
				( user ) => !!user
			) )
		.handle( "getLoginOptions", ( { payload } ) =>
			Effect.gen( function* () {
				const context = yield* AuthHttpContext;
				const user = yield* Effect.promise( () => getUserByUsername( payload.username ) );
				if ( !user ) {
					return yield* Effect.fail( new HttpApiError.BadRequest() );
				}
				const url = new URL( context.url );
				const options = yield* Effect.promise( () => generateAuthenticationOptions( {
					rpID: url.hostname,
					userVerification: "preferred",
					allowCredentials: []
				} ) );
				yield* Effect.promise( () => db.insert( webauthnOptions ).values( {
					username: payload.username,
					challenge: options.challenge
				} ) );
				return options;
			} ) )
		.handle( "verifyLogin", ( { payload } ) =>
			Effect.gen( function* () {
				const context = yield* AuthHttpContext;
				const response = payload.response as AuthenticationResponseJSON;

				const options = yield* Effect.promise( () => getWebAuthnOptions( payload.username ) );
				if ( !options ) {
					return yield* Effect.fail( new HttpApiError.BadRequest() );
				}
				const user = yield* Effect.promise( () => getUserByUsername( payload.username ) );
				if ( !user ) {
					return yield* Effect.fail( new HttpApiError.BadRequest() );
				}
				const passkey = yield* Effect.promise( () => db.query.passkeys.findFirst( {
					where: and( eq( passkeys.id, response.id ), eq( passkeys.userId, user.id ) )
				} ) );
				if ( !passkey ) {
					return yield* Effect.fail( new HttpApiError.BadRequest() );
				}

				const url = new URL( context.url );
				const verification = yield* Effect.promise( () => verifyAuthenticationResponse( {
					response,
					expectedChallenge: options.challenge,
					expectedOrigin: url.origin,
					expectedRPID: url.hostname,
					credential: { id: passkey.id, publicKey: passkey.publicKey, counter: passkey.counter }
				} ) );
				if ( !verification.verified || !verification.authenticationInfo ) {
					return yield* Effect.fail( new HttpApiError.BadRequest() );
				}

				yield* Effect.promise( () => db.update( passkeys )
					.set( { counter: verification.authenticationInfo.newCounter } )
					.where( eq( passkeys.id, passkey.id ) ) );
				yield* Effect.promise( () => db.delete( webauthnOptions )
					.where( eq( webauthnOptions.username, user.username ) ) );

				const setCookie = yield* Effect.promise( () => createSession( user.id ) );
				context.setCookies.push( setCookie );
			} ) )
		.handle( "getRegisterOptions", ( { payload } ) =>
			Effect.gen( function* () {
				const context = yield* AuthHttpContext;
				const url = new URL( context.url );
				const options = yield* Effect.promise( () => generateRegistrationOptions( {
					userDisplayName: payload.name,
					rpID: url.hostname,
					rpName: "stairway",
					userName: payload.username,
					attestationType: "none",
					authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" }
				} ) );
				yield* Effect.promise( () => db.insert( webauthnOptions ).values( {
					username: payload.username,
					challenge: options.challenge
				} ) );
				return options;
			} ) )
		.handle( "verifyRegistration", ( { payload } ) =>
			Effect.gen( function* () {
				const context = yield* AuthHttpContext;
				const response = payload.response as RegistrationResponseJSON;

				const options = yield* Effect.promise( () => getWebAuthnOptions( payload.username ) );
				if ( !options ) {
					return yield* Effect.fail( new HttpApiError.BadRequest() );
				}
				const url = new URL( context.url );
				const verification = yield* Effect.promise( () => verifyRegistrationResponse( {
					response,
					expectedChallenge: options.challenge,
					expectedRPID: url.hostname,
					expectedOrigin: url.origin
				} ) );
				if ( !verification.verified || !verification.registrationInfo ) {
					return yield* Effect.fail( new HttpApiError.BadRequest() );
				}

				const user = {
					id: generateId(),
					name: payload.name,
					username: payload.username,
					avatar: generateAvatar()
				};
				yield* Effect.promise( () => db.insert( users ).values( user ) );
				yield* Effect.promise( () => db.insert( passkeys ).values( {
					id: verification.registrationInfo.credential.id,
					publicKey: verification.registrationInfo.credential.publicKey,
					userId: user.id,
					counter: verification.registrationInfo.credential.counter
				} ) );
				yield* Effect.promise( () => db.delete( webauthnOptions )
					.where( eq( webauthnOptions.username, payload.username ) ) );

				const setCookie = yield* Effect.promise( () => createSession( user.id ) );
				context.setCookies.push( setCookie );
			} ) )
		.handle( "logout", () =>
			Effect.gen( function* () {
				const context = yield* AuthHttpContext;
				const setCookie = yield* Effect.promise(
					() => destroySession( context.cookieHeader )
				);
				context.setCookies.push( setCookie );
			} ) ) );

// --- Per-request context + Set-Cookie merge (global middleware) ------------
//
// A global `HttpRouter.middleware` that `provides` `AuthHttpContext`. Its handler
// runs per request with `HttpServerRequest` in the fiber context, so it can build
// a fresh context, resolve the user, and — after the wrapped endpoint effect
// yields its `HttpServerResponse` — append any collected `Set-Cookie` headers.
//
// Ref: `effect/unstable/http/HttpRouter` — `middleware` with `{ provides }` +
// `{ global: true }` (see the `SessionMiddleware` example in HttpRouter.d.ts,
// which provides a request service via `Effect.provideService`).

export const AuthHttpContextLive = HttpRouter.middleware<{ provides: AuthHttpContext }>()(
	Effect.gen( function* () {
		return ( httpEffect ) =>
			Effect.gen( function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				const cookieHeader = request.headers[ "cookie" ] ?? "";
				const user = yield* Effect.promise( () => loadSession( cookieHeader ) );
				const setCookies: string[] = [];

				const context = AuthHttpContext.of( {
					url: request.url,
					cookieHeader,
					user,
					setCookies
				} );

				const response = yield* Effect.provideService( httpEffect, AuthHttpContext, context );

				return setCookies.reduce(
					( res, value ) => HttpServerResponse.setHeader( res, "set-cookie", value ),
					response
				);
			} );
	} ),
	{ global: true }
);
