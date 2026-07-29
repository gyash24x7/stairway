// @s2h/auth/api — the auth API *definition* (browser-safe).
//
// The seven WebAuthn/session endpoints as an Effect v4 `HttpApiGroup`. This
// module is endpoint definitions ONLY — no handlers, no `db`, no
// `@simplewebauthn/server`, no sessions. That keeps it importable from the
// browser client (via the composed `StairwayAPI`) without dragging server-only
// code into the SPA's type graph. The handler implementations live in the
// serving app (`apps/api/src/auth.ts`), built against the merged root api.

import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import { UserNotFound, VerifyLoginErrors, VerifyRegistrationErrors } from "./errors";
import {
	AuthInfo,
	type LoginOptions,
	type RegisterOptions,
	RegisterOptionsInput,
	UsernameInput,
	VerifyLoginInput,
	VerifyRegistrationInput
} from "./schema";

// --- API definition --------------------------------------------------------

export const AuthApiGroup = HttpApiGroup.make( "auth" ).prefix( "/auth" ).add(
	HttpApiEndpoint.get( "me", "/me", { success: Schema.NullOr( AuthInfo ) } ),
	HttpApiEndpoint.post( "checkIfUserExists", "/checkIfUserExists", {
		payload: UsernameInput,
		success: Schema.Boolean
	} ),
	HttpApiEndpoint.post( "getLoginOptions", "/getLoginOptions", {
		payload: UsernameInput,
		success: Schema.Any as Schema.Schema<LoginOptions>,
		error: UserNotFound
	} ),
	HttpApiEndpoint.post( "verifyLogin", "/verifyLogin", {
		payload: VerifyLoginInput,
		error: VerifyLoginErrors
	} ),
	HttpApiEndpoint.post( "getRegisterOptions", "/getRegisterOptions", {
		payload: RegisterOptionsInput,
		success: Schema.Any as Schema.Schema<RegisterOptions>
	} ),
	HttpApiEndpoint.post( "verifyRegistration", "/verifyRegistration", {
		payload: VerifyRegistrationInput,
		error: VerifyRegistrationErrors
	} ),
	HttpApiEndpoint.post( "logout", "/logout" )
);
