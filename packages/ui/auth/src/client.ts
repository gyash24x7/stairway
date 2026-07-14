// Data-access layer for the auth UI.
//
// Thin, typed helpers over the Effect v4 `HttpApiClient` returned by
// `getClient()` (`@s2h/api/client`). Every helper builds the endpoint's
// `{ payload }` request, bridges the returned `Effect` to a Promise with
// `run()` (which throws the typed failure), and hands the decoded success
// value back to the caller. Components never touch `getClient` or `Effect`
// directly.
//
// The seven auth endpoints are all payload-only (no path params); WebAuthn
// option/response objects are opaque JSON at the boundary (`Schema.Unknown`).

import { getClient, run } from "@s2h/api/client";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).auth;

/** True if a passkey user already exists for `username`. */
export const checkUserFn = ( username: string ): Promise<boolean> =>
	run( client.checkIfUserExists( { payload: { username } } ) );

/** Fetch WebAuthn authentication options (opaque JSON for `startAuthentication`). */
export const getLoginOptionsFn = ( username: string ): Promise<unknown> =>
	run( client.getLoginOptions( { payload: { username } } ) );

/** Verify a WebAuthn authentication response; sets the session cookie server-side. */
export const verifyLoginFn = ( username: string, response: unknown ): Promise<void> =>
	run( client.verifyLogin( { payload: { username, response } } ) );

/** Fetch WebAuthn registration options (opaque JSON for `startRegistration`). */
export const getRegisterOptionsFn = ( username: string, name: string ): Promise<unknown> =>
	run( client.getRegisterOptions( { payload: { username, name } } ) );

/** Verify a WebAuthn registration response; sets the session cookie server-side. */
export const verifyRegistrationFn = (
	username: string,
	name: string,
	response: unknown
): Promise<void> =>
	run( client.verifyRegistration( { payload: { username, name, response } } ) );

/** Clear the session cookie server-side. */
export const logoutFn = (): Promise<void> =>
	run( client.logout( {} ) );
