import { RegisterInput } from "@/auth/shared/schema";
import * as schema from "@/platform/database/schema";
import { Database, DatabaseLive } from "@/platform/database/service";
import { SessionStore, SessionStoreLive } from "@/platform/kv/session";
import { passkey } from "@better-auth/passkey";
import type { HttpEffect } from "alchemy/Http";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { Schema } from "effect";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

/**
 * Parse and validate the client-supplied registration `context` string.
 */
const parseRegistrationContext = ( context?: string | null ) => {
	if ( !context ) {
		throw new APIError( "BAD_REQUEST", { message: "Registration context is required." } );
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse( context );
	} catch {
		throw new APIError( "BAD_REQUEST", { message: "Registration context is malformed." } );
	}

	const option = Schema.decodeUnknownOption( RegisterInput )( parsed );
	if ( Option.isNone( option ) ) {
		throw new APIError( "BAD_REQUEST", { message: "Required fields not present!" } );
	}

	return option.value;
};

const makeAuth = () => Effect.gen( function* () {
	const db = yield* Database;
	const sessionStore = yield* SessionStore;

	const rpId = yield* Config.string( "WEBAUTHN_RP_ID" );
	const rpOrigin = yield* Config.string( "WEBAUTHN_RP_ORIGIN" );
	const secret = yield* Config.string( "AUTH_SECRET" );
	const baseURL = yield* Config.string( "BETTER_AUTH_URL" );

	return betterAuth( {
		secret,
		baseURL,
		basePath: "/api/auth",
		trustedOrigins: [ rpOrigin ],
		database: drizzleAdapter( db, { provider: "sqlite", schema, usePlural: true } ),
		emailAndPassword: { enabled: false },
		session: {
			expiresIn: 60 * 60 * 24 * 30, // 30 days
			updateAge: 60 * 60 * 24, // refresh once/day
			storeSessionInDatabase: true,
			cookieCache: { enabled: true, maxAge: 60 * 5 }
		},
		secondaryStorage: sessionStore,
		rateLimit: { enabled: true, storage: "secondary-storage" },
		plugins: [
			passkey( {
				rpID: rpId,
				rpName: "Stairway",
				origin: rpOrigin,
				registration: {
					requireSession: false,
					resolveUser: async ( { ctx, context } ) => {
						const { name, email } = parseRegistrationContext( context );
						const existing = await ctx.context.internalAdapter.findUserByEmail( email );
						if ( existing ) {
							throw new APIError( "UNPROCESSABLE_ENTITY", {
								message: "An account with this email already exists. Sign in with your passkey instead."
							} );
						}

						const user = await ctx.context.internalAdapter.createUser( {
							name,
							email,
							emailVerified: false
						} );

						return { id: user.id, name: user.name };
					}
				}
			} )
		]
	} );
} );

export class BetterAuth extends Context.Service<BetterAuth, {
	readonly auth: Effect.Success<ReturnType<typeof makeAuth>>;
	readonly fetch: HttpEffect;
}>()( "auth/BetterAuth" ) {}

export const BetterAuthLive = Layer.effect(
	BetterAuth,
	Effect.gen( function* () {
		const auth = yield* makeAuth();

		const fetch = Effect.gen( function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			const raw = yield* HttpServerRequest.toWeb( request );
			const response = yield* Effect.promise( () => auth.handler( raw ) );
			return HttpServerResponse.fromWeb( response );
		} ).pipe(
			Effect.catch( err => Effect.succeed(
				HttpServerResponse.fromWeb( Response.json( { err: err.message }, { status: 500 } ) )
			) )
		);

		return { auth, fetch };
	} )
).pipe(
	Layer.provide( DatabaseLive ),
	Layer.provide( SessionStoreLive )
);