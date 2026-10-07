import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as AtomHttpApi from "effect/reactivity/AtomHttpApi";

import type {
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON
} from "@simplewebauthn/browser";
import { startAuthentication, startRegistration, WebAuthnError } from "@simplewebauthn/browser";

import { AuthApi } from "@/auth/contract";
import type { RegisterInput } from "@/auth/schema";
import { AuthenticationFailed, RegistrationFailed } from "@/auth/schema";


export class ApiClient extends AtomHttpApi.Service<ApiClient>()(
	"auth/ApiClient",
	{ api: AuthApi, httpClient: FetchHttpClient.layer }
) {}


/** Current session, or `null` when logged out. */
export const fetchMeAtom = ApiClient.query( "auth", "me", { reactivityKeys: [ "me" ] } );

/**
 * The passkey prompt was dismissed, timed out, or superseded by another
 * ceremony. Nothing failed, so callers should stay silent rather than surface
 * this to the user.
 */
export class PasskeyDismissed extends Schema.TaggedError<PasskeyDismissed>()(
	"auth/PasskeyDismissed",
	{}
) {}

/**
 * A dismissed prompt reaches us either as `ERROR_CEREMONY_ABORTED` or as a
 * pass-through of the authenticator's own `NotAllowedError`, which is also what
 * the browser reports for a ceremony timeout.
 */
const isDismissal = ( error: unknown ): boolean => {
	if ( error instanceof WebAuthnError ) {
		return error.code === "ERROR_CEREMONY_ABORTED"
			|| ( error.cause instanceof Error && error.cause.name === "NotAllowedError" );
	}

	return error instanceof Error
		&& ( error.name === "NotAllowedError" || error.name === "AbortError" );
};

const ceremonyReason = ( error: unknown ) => error instanceof Error && error.message.length > 0
	? error.message
	: "The passkey prompt could not be completed.";

/**
 * Passkey login: fetch request options, run the browser assertion ceremony,
 * then verify server-side. `loginVerify` sets the session cookie on success, so
 * the `me` reactivity key refetches {@link fetchMeAtom} with the new session.
 */
export const loginWithPasskeyAtom = ApiClient.runtime.fn(
	Effect.fnUntraced( function* () {
		const client = yield* ApiClient;
		const { flowId, options } = yield* client.auth.loginOptions();

		const response = yield* Effect.tryPromise( {
			try: () => startAuthentication( {
				optionsJSON: options as PublicKeyCredentialRequestOptionsJSON
			} ),
			catch: error => isDismissal( error )
				? new PasskeyDismissed()
				: new AuthenticationFailed( { reason: ceremonyReason( error ) } )
		} );

		return yield* client.auth.loginVerify( { payload: { flowId, response } } );
	} ),
	{ reactivityKeys: [ "me" ] }
);

/**
 * Passkey registration: fetch creation options, run the browser attestation
 * ceremony, then verify server-side. `registerVerify` creates the account and
 * sets the session cookie, so the user is logged in on success.
 */
export const registerWithPasskeyAtom = ApiClient.runtime.fn(
	Effect.fnUntraced( function* ( input: RegisterInput ) {
		const client = yield* ApiClient;
		const { flowId, options } = yield* client.auth.registerOptions( { payload: input } );

		const response = yield* Effect.tryPromise( {
			try: () => startRegistration( {
				optionsJSON: options as PublicKeyCredentialCreationOptionsJSON
			} ),
			catch: error => isDismissal( error )
				? new PasskeyDismissed()
				: new RegistrationFailed( { reason: ceremonyReason( error ) } )
		} );

		return yield* client.auth.registerVerify( { payload: { flowId, response } } );
	} ),
	{ reactivityKeys: [ "me" ] }
);

/**
 * Clears the session cookie. The `me` reactivity key refetches
 * {@link fetchMeAtom}, so the navbar drops back to the login button.
 */
export const logoutAtom = ApiClient.runtime.fn(
	Effect.fnUntraced( function* () {
		const client = yield* ApiClient;
		return yield* client.auth.logout();
	} ),
	{ reactivityKeys: [ "me" ] }
);
