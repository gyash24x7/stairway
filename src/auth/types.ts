import type { AuthenticatorDevice } from "@simplewebauthn/typescript-types";

export type AuthInfo = {
	id: string;
	name: string;
	username: string;
	avatar: string;
}

export type AuthContext = {
	authInfo: AuthInfo;
}

export type Session = { currentChallenge?: string; username?: string; };

export type UserDevice = Omit<AuthenticatorDevice, "credentialPublicKey" | "credentialID"> & {
	credentialID: string;
	credentialPublicKey: string;
};

export type User = {
	id: string;
	name: string;
	username: string;
	avatar: string;
	devices: UserDevice[];
};