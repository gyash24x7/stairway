import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";

/** Authenticated user information stored in the session. */
export type AuthInfo = {
	id: string;
	name: string;
	username: string;
	avatar: string;
};

/** Input containing a username for auth actions. */
export type UsernameInput = { username: string };

/** Input containing a display name for registration. */
export type NameInput = { name: string };

/** Input for verifying a WebAuthn login with the authentication response. */
export type VerifyLoginInput = UsernameInput & {
	response: AuthenticationResponseJSON
}

/** Input for verifying a WebAuthn registration with the registration response. */
export type VerifyRegistrationInput = UsernameInput & NameInput & {
	response: RegistrationResponseJSON
}