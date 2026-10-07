import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import * as Persistable from "effect/persistence/Persistable";
import * as Persistence from "effect/persistence/Persistence";

import type {
	AuthenticationResponseJSON,
	RegistrationResponseJSON,
	VerifiedAuthenticationResponse,
	VerifiedRegistrationResponse,
	WebAuthnCredential
} from "@simplewebauthn/server";
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";

import type { LoginOptions, RegisterOptions } from "@/auth/schema";
import { AuthFlow } from "@/auth/schema";


/** A ceremony is short-lived; the flow must not outlive it in Redis. */
const FLOW_TTL = Duration.minutes( 5 );


// --- WebAuthn RpConfig ----------------------------------------------------

export const RpConfig = Effect.all( {
	rpName: Effect.succeed( "Stairway" ),
	rpID: Config.String( "WEBAUTHN_RP_ID" ),
	rpOrigin: Config.String( "WEBAUTHN_RP_ORIGIN" )
} ).pipe( Effect.orDie );


// --- WebAuthn Service ----------------------------------------------------

export class AuthFlowEntry extends Persistable.Class<{ payload: { flowId: string } }>()(
	"auth/AuthFlowEntry",
	{ primaryKey: ( { flowId } ) => flowId, success: AuthFlow }
) {}

export class WebAuthnService extends Context.Service<WebAuthnService, {
	readonly getRegisterOptions: ( username: string ) => Effect.Effect<RegisterOptions>;
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
	readonly getAuthFlow: ( flowId: string ) => Effect.Effect<Option.Option<AuthFlow>>;
	readonly deleteAuthFlow: ( flowId: string ) => Effect.Effect<void>;

}>()( "auth/WebAuthnService" ) {}

export const WebAuthnServiceLive = Layer.effect(
	WebAuthnService,
	Effect.gen( function* () {
		const persistence = yield* Persistence.Persistence;
		const store = yield* persistence.make( { storeId: "webauthn", timeToLive: () => FLOW_TTL } );
		const { rpName, rpID, rpOrigin } = yield* RpConfig;

		return WebAuthnService.of( {
			getRegisterOptions: Effect.fn( function* ( username: string ) {
				return yield* Effect.promise( () => generateRegistrationOptions( {
					rpName,
					rpID,
					userName: username,
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
				const entry = yield* store.get( new AuthFlowEntry( { flowId } ) ).pipe( Effect.orDie );
				return entry && Exit.isSuccess( entry )
					? Option.some( entry.value )
					: Option.none<AuthFlow>();
			} ),

			setAuthFlow: Effect.fn( function* ( flow: AuthFlow ) {
				yield* store.set( new AuthFlowEntry( { flowId: flow.id } ), Exit.succeed( flow ) )
					.pipe( Effect.orDie );
			} ),

			deleteAuthFlow: Effect.fn( function* ( flowId: string ) {
				yield* store.remove( new AuthFlowEntry( { flowId } ) ).pipe( Effect.orDie );
			} )
		} );
	} )
);
