import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import type {
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
	AuthenticationResponseJSON,
	RegistrationResponseJSON,
	WebAuthnCredential,
	VerifiedRegistrationResponse,
	VerifiedAuthenticationResponse
} from "@simplewebauthn/server";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import type * as Alchemy from "alchemy";
import * as Layer from "effect/Layer";

import type { AuthFlow } from "@/auth/shared/schema.ts";

const RP_NAME = "Stairway";

/**
 * RP identity read once per call from config. A missing/invalid value is an
 * operator misconfiguration, so it becomes a defect (`orDie`) rather than a
 * domain error the ceremony endpoints have to declare.
 */
const RpConfig = Effect.all( {
	rpID: Config.string( "WEBAUTHN_RP_ID" ),
	rpOrigin: Config.string( "WEBAUTHN_RP_ORIGIN" )
} ).pipe( Effect.orDie );


/**
 * Short-lived WebAuthn challenges keyed by an opaque `flowId`: the value is the
 * pending ceremony (challenge string plus, for registration, the requested
 * name/email). Separate effectful store from {@link SessionStore}; shares the KV
 * namespace under its own key prefix and relies on KV TTL for expiry.
 */
export class WebAuthnStore extends Context.Service<WebAuthnStore, {
	readonly get: ( key: string ) => Effect.Effect<AuthFlow | null, never, Alchemy.RuntimeContext>;

	readonly set: ( key: string, value: AuthFlow ) =>
		Effect.Effect<void, never, Alchemy.RuntimeContext>;

	readonly delete: ( key: string ) => Effect.Effect<void, never, Alchemy.RuntimeContext>;
}>()( "auth/WebAuthnStore" ) {}

/**
 * WebAuthn Service to capture webauthn logic
 */
export class WebAuthnService extends Context.Service<WebAuthnService, {
	readonly getRegisterOptions: ( email: string ) =>
		Effect.Effect<PublicKeyCredentialCreationOptionsJSON>;

	readonly getLoginOptions: () => Effect.Effect<PublicKeyCredentialRequestOptionsJSON>;

	readonly verifyRegistration: (
		response: RegistrationResponseJSON,
		expectedChallenge: string
	) => Effect.Effect<VerifiedRegistrationResponse>;

	readonly verifyLogin: (
		response: AuthenticationResponseJSON,
		expectedChallenge: string,
		credential: WebAuthnCredential
	) => Effect.Effect<VerifiedAuthenticationResponse>;

	readonly setAuthFlow: ( flow: AuthFlow ) => Effect.Effect<void, never, Alchemy.RuntimeContext>;

	readonly getAuthFlow: ( flowId: string ) =>
		Effect.Effect<AuthFlow | null, never, Alchemy.RuntimeContext>;

	readonly deleteAuthFlow: ( flowId: string ) => Effect.Effect<void, never, Alchemy.RuntimeContext>;

}>()( "auth/WebAuthnService" ) {}

export const WebAuthnServiceLive = Layer.effect(
	WebAuthnService,
	Effect.gen( function* () {
		const store = yield* WebAuthnStore;
		const { rpID, rpOrigin } = yield* RpConfig;

		return WebAuthnService.of( {
			getRegisterOptions: Effect.fn( function* ( email: string ) {
				return yield* Effect.promise( () => generateRegistrationOptions( {
					rpName: RP_NAME,
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
				return yield* store.set( flow.id, flow );
			} ),

			deleteAuthFlow: Effect.fn( function* ( flowId: string ) {
				return yield* store.delete( flowId );
			} )
		} );
	} )
);