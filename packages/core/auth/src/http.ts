// @s2h/auth/http — the auth API as an Effect v4 HttpApi group.
//
// The effectful twin of ./router.ts (oRPC). Same seven WebAuthn/session flows,
// same DB + `@simplewebauthn/server` calls — just expressed as `HttpApiEndpoint`s
// with Effect handlers. Async work is wrapped with `Effect.promise`; the login /
// register / logout flows append their `Set-Cookie` onto `HttpAppContext.resHeaders`
// exactly like the oRPC procedures do. Auth uses no swish engine.
//
// Server-only. Not served yet: `AuthApiLive`'s residual requirement is
// `HttpAppContext`, which the Worker provides per-request when it decides to mount
// this. Additive — the oRPC auth router stays for now.

import { Effect, Schema } from "effect";
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { HttpAppContext } from "@s2h/api/context";
import { BadRequest } from "@s2h/api/errors";
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
import { createSession, destroySession } from "./sessions";

const getUserByUsername = ( username: string ) =>
	db.query.users.findFirst( { where: eq( users.username, username ) } );

const getWebAuthnOptions = ( username: string ) =>
	db.query.webauthnOptions.findFirst( { where: eq( webauthnOptions.username, username ) } );

// --- DTO schemas -----------------------------------------------------------
// WebAuthn option/response objects are opaque JSON at the boundary: `Schema.Unknown`
// + a cast in the handler (the `@simplewebauthn/server` types are the source of truth).

const AuthInfoSchema = Schema.Struct( {
	id: Schema.String,
	name: Schema.String,
	username: Schema.String,
	avatar: Schema.String
} );

const UsernameInput = Schema.Struct( { username: Schema.String } );
const RegisterOptionsInput = Schema.Struct( { username: Schema.String, name: Schema.String } );
const LoginInput = Schema.Struct( { username: Schema.String, response: Schema.Unknown } );
const RegisterInput = Schema.Struct( {
	username: Schema.String,
	name: Schema.String,
	response: Schema.Unknown
} );

// --- API definition --------------------------------------------------------

const AuthGroup = HttpApiGroup.make( "auth" ).add(
	HttpApiEndpoint.get( "me", "/auth/me", { success: Schema.NullOr( AuthInfoSchema ) } ),
	HttpApiEndpoint.post( "checkIfUserExists", "/auth/checkIfUserExists", {
		payload: UsernameInput,
		success: Schema.Boolean
	} ),
	HttpApiEndpoint.post( "getLoginOptions", "/auth/getLoginOptions", {
		payload: UsernameInput,
		success: Schema.Unknown,
		error: BadRequest
	} ),
	HttpApiEndpoint.post( "verifyLogin", "/auth/verifyLogin", {
		payload: LoginInput,
		error: BadRequest
	} ),
	HttpApiEndpoint.post( "getRegisterOptions", "/auth/getRegisterOptions", {
		payload: RegisterOptionsInput,
		success: Schema.Unknown
	} ),
	HttpApiEndpoint.post( "verifyRegistration", "/auth/verifyRegistration", {
		payload: RegisterInput,
		error: BadRequest
	} ),
	HttpApiEndpoint.post( "logout", "/auth/logout" )
);

export class AuthApi extends HttpApi.make( "auth" ).add( AuthGroup ) {}

// --- Handlers (residual requirement: `HttpAppContext`) ---------------------

export const AuthApiLive = HttpApiBuilder.group( AuthApi, "auth", ( handlers ) =>
	handlers
		.handle( "me", () => Effect.map( HttpAppContext, ( context ) => context.user ) )
		.handle( "checkIfUserExists", ( { payload } ) =>
			Effect.map(
				Effect.promise( () => getUserByUsername( payload.username ) ),
				( user ) => !!user
			) )
		.handle( "getLoginOptions", ( { payload } ) =>
			Effect.gen( function* () {
				const context = yield* HttpAppContext;
				const user = yield* Effect.promise( () => getUserByUsername( payload.username ) );
				if ( !user ) {
					return yield* Effect.fail( new BadRequest() );
				}
				const url = new URL( context.req.url );
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
				const context = yield* HttpAppContext;
				const response = payload.response as AuthenticationResponseJSON;

				const options = yield* Effect.promise( () => getWebAuthnOptions( payload.username ) );
				if ( !options ) {
					return yield* Effect.fail( new BadRequest() );
				}
				const user = yield* Effect.promise( () => getUserByUsername( payload.username ) );
				if ( !user ) {
					return yield* Effect.fail( new BadRequest() );
				}
				const passkey = yield* Effect.promise( () => db.query.passkeys.findFirst( {
					where: and( eq( passkeys.id, response.id ), eq( passkeys.userId, user.id ) )
				} ) );
				if ( !passkey ) {
					return yield* Effect.fail( new BadRequest() );
				}

				const url = new URL( context.req.url );
				const verification = yield* Effect.promise( () => verifyAuthenticationResponse( {
					response,
					expectedChallenge: options.challenge,
					expectedOrigin: url.origin,
					expectedRPID: url.hostname,
					credential: { id: passkey.id, publicKey: passkey.publicKey, counter: passkey.counter }
				} ) );
				if ( !verification.verified || !verification.authenticationInfo ) {
					return yield* Effect.fail( new BadRequest() );
				}

				yield* Effect.promise( () => db.update( passkeys )
					.set( { counter: verification.authenticationInfo.newCounter } )
					.where( eq( passkeys.id, passkey.id ) ) );
				yield* Effect.promise( () => db.delete( webauthnOptions )
					.where( eq( webauthnOptions.username, user.username ) ) );

				const setCookie = yield* Effect.promise( () => createSession( user.id ) );
				context.resHeaders.append( "Set-Cookie", setCookie );
			} ) )
		.handle( "getRegisterOptions", ( { payload } ) =>
			Effect.gen( function* () {
				const context = yield* HttpAppContext;
				const url = new URL( context.req.url );
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
				const context = yield* HttpAppContext;
				const response = payload.response as RegistrationResponseJSON;

				const options = yield* Effect.promise( () => getWebAuthnOptions( payload.username ) );
				if ( !options ) {
					return yield* Effect.fail( new BadRequest() );
				}
				const url = new URL( context.req.url );
				const verification = yield* Effect.promise( () => verifyRegistrationResponse( {
					response,
					expectedChallenge: options.challenge,
					expectedRPID: url.hostname,
					expectedOrigin: url.origin
				} ) );
				if ( !verification.verified || !verification.registrationInfo ) {
					return yield* Effect.fail( new BadRequest() );
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
				context.resHeaders.append( "Set-Cookie", setCookie );
			} ) )
		.handle( "logout", () =>
			Effect.gen( function* () {
				const context = yield* HttpAppContext;
				const setCookie = yield* Effect.promise(
					() => destroySession( context.req.headers.get( "Cookie" ) ?? "" )
				);
				context.resHeaders.append( "Set-Cookie", setCookie );
			} ) ) );
