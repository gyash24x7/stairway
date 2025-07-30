import type * as schema from "@/auth/schema";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";

export type AuthInfo = {
	id: string;
	name: string;
	username: string;
	avatar: string;
}

export type AuthContext = {
	authInfo: AuthInfo;
}

export type User = typeof schema.users.$inferSelect;
export type Passkey = typeof schema.passkeys.$inferSelect;

export type WebAuthnOptions = { webauthnUserId?: string; challenge: string };

export type Session = {
	id: string;
	userId: string;
	expiresAt: string;
}

export type SessionParts = {
	unsignedSessionId: string;
	signature: string;
}

export type SessionValidationResult = { session: Session, user: User };

export type UsernameInput = {
	username: string;
	name?: string;
}

export type VerifyRegistrationInput = {
	username: string;
	name: string;
	response: RegistrationResponseJSON;
}

export type VerifyLoginInput = {
	username: string;
	response: AuthenticationResponseJSON;
}