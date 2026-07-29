// @s2h/auth/service — the auth business logic, extracted from the HTTP handlers.
//
// `AuthService` bundles the seven WebAuthn/session flows (DB access +
// `@simplewebauthn/server` + session cookies) as plain, requirement-free Effects.
// The serving app's handlers (`apps/api/src/auth.ts`) become thin: they read the
// per-request `AuthHttpContext` and delegate to this service. `makeAuthService( db )`
// captures a concrete Drizzle client, so every method is `R = never` — the host builds
// it once per isolate and provides it as a concrete `AuthService` instance (see
// `apps/api/src/worker.ts`). Validation failures surface as `HttpApiError.BadRequest`,
// matching the endpoint error declarations in `./api`.

import { Database } from "@s2h/db";
import { passkeys, sessions, users, webauthnOptions } from "@s2h/db/schema";
import { generateAvatar, generateId } from "@s2h/utils/generator";
import {
	type AuthenticationResponseJSON,
	generateAuthenticationOptions,
	generateRegistrationOptions,
	type RegistrationResponseJSON,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import * as cookie from "cookie";
import { and, eq, gt } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { AuthHttpContext } from "./context";
import {
	InvalidResponse,
	OptionsNotFound,
	PasskeyNotFound,
	UserNotFound,
	type VerifyLoginErrors,
	type VerifyRegistrationErrors
} from "./errors";
import {
	AuthInfo,
	type LoginOptions,
	type RegisterOptions,
	type RegisterOptionsInput,
	type VerifyLoginInput,
	type VerifyRegistrationInput
} from "./schema";
import { parseToken, serializeToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "./utils";


/**
 * Effect service tag holding the auth operations.
 * Provided as a concrete instance by the host.
 */
export class AuthService extends Context.Service<AuthService, {

	/**
	 * True if a user with this username already exists.
	 * @param username - Username of the user
	 * @returns boolean - True if user exists else false
	 */
	readonly checkIfUserExists: ( username: string ) => Effect.Effect<boolean, never, Database>;

	/**
	 * WebAuthn authentication options for an existing user
	 * (fails if unknown). `url` → rpID.
	 *
	 * @param username - Username of the user
	 * @param url - Request URL
	 * @returns LoginOptions - Login options for this user
	 */
	readonly getLoginOptions: ( username: string ) =>
		Effect.Effect<LoginOptions, UserNotFound, AuthHttpContext>;

	/**
	 * Verify a login assertion; on success returns
	 * a `Set-Cookie` for the new session.
	 */
	readonly verifyLogin: ( payload: VerifyLoginInput ) =>
		Effect.Effect<void, VerifyLoginErrors, AuthHttpContext>;

	/**
	 * WebAuthn registration options for a new user. `url` → rpID.
	 */
	readonly getRegisterOptions: ( payload: RegisterOptionsInput ) =>
		Effect.Effect<RegisterOptions, never, AuthHttpContext>;

	/**
	 * Verify a registration attestation, create the user + passkey;
	 * returns a session `Set-Cookie`.
	 */
	readonly verifyRegistration: ( payload: VerifyRegistrationInput ) =>
		Effect.Effect<void, VerifyRegistrationErrors, AuthHttpContext>;

	/**
	 * Destroy the session referenced by the cookie header;
	 * returns an expiring `Set-Cookie`.
	 */
	readonly logout: () => Effect.Effect<void, never, AuthHttpContext>;

	/**
	 * Loads the authenticated user for a request's cookie header, or null if unauthenticated.
	 * Verifies the cookie signature, looks up a non-expired session row, and joins the user.
	 * @param cookieHeader - The raw `Cookie` request header.
	 */
	readonly loadAuthInfo: ( cookieHeader: string ) => Effect.Effect<AuthInfo | null>;

}>()( "auth/AuthService" ) {

	public static readonly layer = Layer.effect( AuthService, Effect.gen( function* () {
		const db = yield* Database;

		const createSession = ( userId: string ) => Effect.gen( function* () {
			const token = generateId();
			const expiresAt = Math.floor( Date.now() / 1000 ) + SESSION_TTL_SECONDS;

			yield* Effect.promise(
				() => db.insert( sessions ).values( { id: token, userId, expiresAt } )
			);

			const value = yield* Effect.promise( () => serializeToken( token ) );

			const ctx = yield* AuthHttpContext;
			ctx.setCookies.push( cookie.serialize( {
				name: SESSION_COOKIE,
				value,
				httpOnly: true,
				secure: true,
				sameSite: "lax",
				path: "/",
				maxAge: SESSION_TTL_SECONDS
			} ) );
		} );

		return AuthService.of( {
			checkIfUserExists: ( username ) => Effect.gen( function* () {
				const [ user ] = yield* Effect.promise(
					() => db.select().from( users )
						.where( eq( users.username, username ) )
						.limit( 1 )
				);

				return !!user;
			} ),

			getLoginOptions: ( username ) => Effect.gen( function* () {
				const { url } = yield* AuthHttpContext;
				const [ user ] = yield* Effect.promise(
					() => db.select().from( users )
						.where( eq( users.username, username ) )
						.limit( 1 )
				);

				if ( !user ) {
					return yield* new UserNotFound( { username } );
				}

				const options = yield* Effect.promise(
					() => generateAuthenticationOptions( {
						rpID: new URL( url ).hostname,
						userVerification: "preferred",
						allowCredentials: []
					} )
				);

				yield* Effect.promise(
					() => db.insert( webauthnOptions ).values( {
						username,
						challenge: options.challenge
					} )
				);

				return options;
			} ),

			verifyLogin: ( { username, response } ) => Effect.gen( function* () {
				const { url } = yield* AuthHttpContext;
				const assertion = response as AuthenticationResponseJSON;
				const [ options ] = yield* Effect.promise(
					() => db.select()
						.from( webauthnOptions )
						.where( eq( webauthnOptions.username, username ) )
						.limit( 1 )
				);

				if ( !options ) {
					return yield* new OptionsNotFound( { username } );
				}

				const [ user ] = yield* Effect.promise(
					() => db.select().from( users )
						.where( eq( users.username, username ) )
						.limit( 1 )
				);

				if ( !user ) {
					return yield* new UserNotFound( { username } );
				}

				const [ passkey ] = yield* Effect.promise(
					() => db.select()
						.from( passkeys )
						.where( and( eq( passkeys.id, assertion.id ), eq( passkeys.userId, user.id ) ) )
						.limit( 1 )
				);

				if ( !passkey ) {
					return yield* new PasskeyNotFound( { userId: user.id, passkeyId: assertion.id } );
				}

				const requestUrl = new URL( url );
				const verification = yield* Effect.promise( () => verifyAuthenticationResponse( {
					response: assertion,
					expectedChallenge: options.challenge,
					expectedOrigin: requestUrl.origin,
					expectedRPID: requestUrl.hostname,
					credential: { id: passkey.id, publicKey: passkey.publicKey, counter: passkey.counter }
				} ) );

				if ( !verification.verified || !verification.authenticationInfo ) {
					return yield* new InvalidResponse( { username, response } );
				}

				yield* Effect.promise(
					() => db.update( passkeys )
						.set( { counter: verification.authenticationInfo.newCounter } )
						.where( eq( passkeys.id, passkey.id ) )
				);

				yield* Effect.promise(
					() => db.delete( webauthnOptions )
						.where( eq( webauthnOptions.username, user.username ) )
				);

				return yield* createSession( user.id );
			} ),

			getRegisterOptions: ( { name, username } ) => Effect.gen( function* () {
				const { url } = yield* AuthHttpContext;
				const options = yield* Effect.promise(
					() => generateRegistrationOptions( {
						userDisplayName: name,
						rpID: new URL( url ).hostname,
						rpName: "stairway",
						userName: username,
						attestationType: "none",
						authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" }
					} )
				);

				yield* Effect.promise(
					() => db.insert( webauthnOptions ).values( {
						username,
						challenge: options.challenge
					} )
				);

				return options;
			} ),

			verifyRegistration: ( { name, username, response } ) => Effect.gen( function* () {
				const { url } = yield* AuthHttpContext;
				const attestation = response as RegistrationResponseJSON;
				const [ options ] = yield* Effect.promise(
					() => db.select()
						.from( webauthnOptions )
						.where( eq( webauthnOptions.username, username ) )
						.limit( 1 )
				);

				if ( !options ) {
					return yield* new OptionsNotFound( { username } );
				}

				const requestUrl = new URL( url );
				const verification = yield* Effect.promise(
					() => verifyRegistrationResponse( {
						response: attestation,
						expectedChallenge: options.challenge,
						expectedRPID: requestUrl.hostname,
						expectedOrigin: requestUrl.origin
					} )
				);

				if ( !verification.verified || !verification.registrationInfo ) {
					return yield* new InvalidResponse( { username, response } );
				}

				const user = { id: generateId(), name, username, avatar: generateAvatar() };
				yield* Effect.promise( () => db.insert( users ).values( user ) );

				yield* Effect.promise(
					() => db.insert( passkeys ).values( {
						id: verification.registrationInfo.credential.id,
						publicKey: verification.registrationInfo.credential.publicKey,
						userId: user.id,
						counter: verification.registrationInfo.credential.counter
					} )
				);

				yield* Effect.promise(
					() => db.delete( webauthnOptions )
						.where( eq( webauthnOptions.username, username ) )
				);

				return yield* createSession( user.id );
			} ),

			logout: () => Effect.gen( function* () {
				const ctx = yield* AuthHttpContext;
				const value = cookie.parseCookie( ctx.cookieHeader )[ SESSION_COOKIE ];
				if ( value ) {

					const token = yield* Effect.promise( () => parseToken( value ) );
					if ( token ) {
						yield* Effect.promise(
							() => db.delete( sessions ).where( eq( sessions.id, token ) )
						);
					}
				}

				ctx.setCookies.push( cookie.serialize( {
					name: SESSION_COOKIE,
					value: "",
					httpOnly: true,
					secure: true,
					sameSite: "lax",
					path: "/",
					maxAge: 0
				} ) );
			} ),

			loadAuthInfo: ( cookieHeader ) => Effect.gen( function* () {
				const value = cookie.parseCookie( cookieHeader )[ SESSION_COOKIE ];
				if ( !value ) {
					return null;
				}

				const token = yield* Effect.promise( () => parseToken( value ) );
				if ( !token ) {
					return null;
				}

				const now = Math.floor( Date.now() / 1000 );
				const [ row ] = yield* Effect.promise(
					() => db.select().from( sessions )
						.where( and(
							eq( sessions.id, token ),
							gt( sessions.expiresAt, now )
						) )
						.limit( 1 )
				);

				if ( !row ) {
					return null;
				}

				const [ user ] = yield* Effect.promise(
					() => db.select().from( users ).where( eq( users.id, row.userId ) ).limit( 1 )
				);

				if ( !user ) {
					return null;
				}

				return AuthInfo.make( user );
			} )
		} );
	} ) );
}
