import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type {
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON
} from "@simplewebauthn/browser";

import { getClient, run } from "@/client.ts";
import type { RegisterInput } from "@/auth/shared/schema.ts";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).auth;

/** Current session, or `null` when logged out. */
export const fetchMeFn = () => run( client.me() );

/**
 * Passkey registration: fetch creation options, run the browser attestation
 * ceremony, then verify server-side. `registerVerify` creates the account and
 * sets the session cookie, so the user is logged in on success.
 */
export const registerPasskeyFn = async ( input: RegisterInput ) => {
	const { flowId, options } = await run( client.registerOptions( { payload: input } ) );
	const response = await startRegistration( {
		optionsJSON: options as PublicKeyCredentialCreationOptionsJSON
	} );
	await run( client.registerVerify( { payload: { flowId, response } } ) );
};

/**
 * Passkey login: fetch request options, run the browser assertion ceremony,
 * then verify server-side. `loginVerify` sets the session cookie on success.
 */
export const loginPasskeyFn = async () => {
	const { flowId, options } = await run( client.loginOptions() );
	const response = await startAuthentication( {
		optionsJSON: options as PublicKeyCredentialRequestOptionsJSON
	} );
	await run( client.loginVerify( { payload: { flowId, response } } ) );
};

export const logoutFn = () => run( client.logout() );
