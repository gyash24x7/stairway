import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import type {
	AuthenticationResponseJSON,
	RegistrationResponseJSON,
	VerifiedAuthenticationResponse,
	VerifiedRegistrationResponse,
	WebAuthnCredential
} from "@simplewebauthn/server";

import type { AuthFlow, LoginOptions, RegisterOptions } from "@/auth/shared/schema.ts";

// --- WebAuthn RpConfig ----------------------------------------------------

export const RpConfig = Effect.all( {
	rpName: Effect.succeed( "Stairway" ),
	rpID: Config.string( "WEBAUTHN_RP_ID" ),
	rpOrigin: Config.string( "WEBAUTHN_RP_ORIGIN" )
} ).pipe( Effect.orDie );


// --- WebAuthn Flow Store ----------------------------------------------------

export class WebAuthnStore extends Context.Service<WebAuthnStore, {
	readonly get: ( key: string ) => Effect.Effect<AuthFlow | null>;
	readonly put: ( value: AuthFlow ) => Effect.Effect<void>;
	readonly delete: ( key: string ) => Effect.Effect<void>;
}>()( "auth/WebAuthnStore" ) {}


// --- WebAuthn Service ----------------------------------------------------

export class WebAuthnService extends Context.Service<WebAuthnService, {
	readonly getRegisterOptions: ( email: string ) => Effect.Effect<RegisterOptions>;
	readonly getLoginOptions: () => Effect.Effect<LoginOptions>;

	readonly verifyRegistration: (
		response: RegistrationResponseJSON,
		expectedChallenge: string
	) => Effect.Effect<VerifiedRegistrationResponse>;

	readonly verifyLogin: (
		response: AuthenticationResponseJSON,
		expectedChallenge: string,
		credential: WebAuthnCredential
	) => Effect.Effect<VerifiedAuthenticationResponse>;

	readonly setAuthFlow: ( flow: AuthFlow ) => Effect.Effect<void>;
	readonly getAuthFlow: ( flowId: string ) => Effect.Effect<AuthFlow | null>;
	readonly deleteAuthFlow: ( flowId: string ) => Effect.Effect<void>;

}>()( "auth/WebAuthnService" ) {}

export const WebAuthnServiceLive = Layer.effect(
	WebAuthnService,
	Effect.gen( function* () {
		const store = yield* WebAuthnStore;
		const { rpName, rpID, rpOrigin } = yield* RpConfig;

		return WebAuthnService.of( {
			getRegisterOptions: Effect.fn( function* ( email: string ) {
				return yield* Effect.promise( () => generateRegistrationOptions( {
					rpName,
					rpID,
					userName: email,
					attestationType: "none",
					authenticatorSelection: { residentKey: "required", userVerification: "preferred" }
				} ) );
			} ),

			getLoginOptions: Effect.fn( function* () {
				return yield* Effect.promise(
					() => generateAuthenticationOptions( { rpID, userVerification: "preferred" } )
				);
			} ),

			verifyRegistration: Effect.fn( function* (
				response: RegistrationResponseJSON,
				expectedChallenge: string
			) {
				return yield* Effect.promise( () => verifyRegistrationResponse( {
					response,
					expectedChallenge,
					expectedOrigin: rpOrigin,
					expectedRPID: rpID,
					requireUserVerification: false
				} ) );
			} ),

			verifyLogin: Effect.fn( function* (
				response: AuthenticationResponseJSON,
				expectedChallenge: string,
				credential: WebAuthnCredential
			) {
				return yield* Effect.promise( () => verifyAuthenticationResponse( {
					response,
					expectedChallenge,
					expectedOrigin: rpOrigin,
					expectedRPID: rpID,
					credential,
					requireUserVerification: false
				} ) );
			} ),

			getAuthFlow: Effect.fn( function* ( flowId: string ) {
				return yield* store.get( flowId );
			} ),

			setAuthFlow: Effect.fn( function* ( flow: AuthFlow ) {
				return yield* store.put( flow );
			} ),

			deleteAuthFlow: Effect.fn( function* ( flowId: string ) {
				return yield* store.delete( flowId );
			} )
		} );
	} )
);
