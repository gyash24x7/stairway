import type { RequestHeadersPluginContext, ResponseHeadersPluginContext } from "@orpc/server/plugins";
import type {
	AuthenticationResponseJSON,
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
	RegistrationResponseJSON
} from "@simplewebauthn/server";
import { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema.ts";

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

export type RegisterOptions = PublicKeyCredentialCreationOptionsJSON;

export type VerifyLoginInput = UsernameInput & { response: AuthenticationResponseJSON; };

export type VerifyRegistrationInput = UsernameInput & NameInput & { response: RegistrationResponseJSON };

export type Bindings = {
	DB: D1Database;
	WEBAUTHN_KV: KVNamespace;
	SESSION_KV: KVNamespace;
	AUTH_SECRET_KEY: string;
}

export type Variables = {
	db: DrizzleD1Database<typeof schema>;
	rpId: string;
	rpOrigin: string;
}

export type InitialContext = RequestHeadersPluginContext & ResponseHeadersPluginContext & { env: Bindings };
export type Context = InitialContext & Variables;