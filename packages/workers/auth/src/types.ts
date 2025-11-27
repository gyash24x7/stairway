import type {
	AuthenticationResponseJSON,
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
	RegistrationResponseJSON
} from "@simplewebauthn/server";

export type WebauthnOptions = { webauthnUserId?: string; challenge: string; };

export type AuthInfo = {
	id: string;
	name: string;
	username: string;
	avatar: string;
};

export type Session = {
	id: string;
	authInfo: AuthInfo;
	createdAt: number;
}

export type NameInput = { name: string; };

export type UsernameInput = { username: string; };

export type LoginOptions = PublicKeyCredentialRequestOptionsJSON;

export type RegistrationOptions = PublicKeyCredentialCreationOptionsJSON;

export type VerifyLoginInput = UsernameInput & { response: AuthenticationResponseJSON; };

export type VerifyRegistrationInput = UsernameInput & NameInput & { response: RegistrationResponseJSON };
