import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

import type {
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON
} from "@simplewebauthn/browser";

import { client, run } from "@/client.ts";

import type { RegisterInput } from "@/auth/shared/schema.ts";

/** Current session, or `null` when logged out. */
export const fetchMeFn = () => run( client.auth.me() );

/**
 * Passkey registration: fetch creation options, run the browser attestation
 * ceremony, then verify server-side. `registerVerify` creates the account and
 * sets the session cookie, so the user is logged in on success.
 */
export const registerPasskeyFn = async( input: RegisterInput ) => {
	const { flowId, options } = await run( client.auth.registerOptions( { payload: input } ) );
	const response = await startRegistration( {
		optionsJSON: options as PublicKeyCredentialCreationOptionsJSON
	} );

	await run( client.auth.registerVerify( { payload: { flowId, response } } ) );
};

/**
 * Passkey login: fetch request options, run the browser assertion ceremony,
 * then verify server-side. `loginVerify` sets the session cookie on success.
 */
export const loginPasskeyFn = async() => {
	const { flowId, options } = await run( client.auth.loginOptions() );
	const response = await startAuthentication( {
		optionsJSON: options as PublicKeyCredentialRequestOptionsJSON
	} );

	await run( client.auth.loginVerify( { payload: { flowId, response } } ) );
};

export const logoutFn = () => run( client.auth.logout() );
