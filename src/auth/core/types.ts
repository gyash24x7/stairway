import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";

export type AuthInfo = {
	id: string;
	name: string;
	username: string;
	avatar: string;
};

export type SessionData = {
	authInfo: AuthInfo | null;
}

export type UsernameInput = { username: string };

export type NameInput = { name: string };

export type VerifyLoginInput = UsernameInput & {
	response: AuthenticationResponseJSON
}

export type VerifyRegistrationInput = UsernameInput & NameInput & {
	response: RegistrationResponseJSON
}