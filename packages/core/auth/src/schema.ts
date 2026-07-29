// --- DTO schemas -----------------------------------------------------------
// WebAuthn option/response objects are opaque JSON at the boundary: `Schema.Unknown`
// + a cast in the handler (the `@simplewebauthn/server` types are the source of truth).

import type {
	AuthenticationResponseJSON,
	generateAuthenticationOptions,
	generateRegistrationOptions,
	RegistrationResponseJSON
} from "@simplewebauthn/server";
import * as Schema from "effect/Schema";

export type AuthInfo = typeof AuthInfo.Type;
export const AuthInfo = Schema.TaggedStruct( "auth/Info", {
	id: Schema.String,
	name: Schema.String,
	username: Schema.String,
	avatar: Schema.String
} );

export type UsernameInput = typeof UsernameInput.Type;
export const UsernameInput = Schema.TaggedStruct(
	"auth/UsernameInput",
	{ username: Schema.String }
);

export type RegisterOptionsInput = typeof RegisterOptionsInput.Type;
export const RegisterOptionsInput = Schema.TaggedStruct(
	"auth/RegisterOptionsInput",
	{ username: Schema.String, name: Schema.String }
);

export type VerifyLoginInput = typeof VerifyLoginInput.Type;
export const VerifyLoginInput = Schema.TaggedStruct(
	"auth/VerifyLoginInput",
	{
		username: Schema.String,
		response: Schema.Any as Schema.Schema<AuthenticationResponseJSON>
	}
);

export type VerifyRegistrationInput = typeof VerifyRegistrationInput.Type;
export const VerifyRegistrationInput = Schema.TaggedStruct(
	"auth/VerifyRegistrationInput",
	{
		username: Schema.String,
		name: Schema.String,
		response: Schema.Any as Schema.Schema<RegistrationResponseJSON>
	}
);

export type LoginOptions = Awaited<ReturnType<typeof generateAuthenticationOptions>>;
export type RegisterOptions = Awaited<ReturnType<typeof generateRegistrationOptions>>;