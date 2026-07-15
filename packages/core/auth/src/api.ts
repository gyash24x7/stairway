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
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

// --- DTO schemas -----------------------------------------------------------
// WebAuthn option/response objects are opaque JSON at the boundary: `Schema.Unknown`
// + a cast in the handler (the `@simplewebauthn/server` types are the source of truth).

export const AuthInfoSchema = Schema.Struct( {
	id: Schema.String,
	name: Schema.String,
	username: Schema.String,
	avatar: Schema.String
} );

export const UsernameInput = Schema.Struct( { username: Schema.String } );
export const RegisterOptionsInput = Schema.Struct( {
	username: Schema.String,
	name: Schema.String
} );
export const LoginInput = Schema.Struct( { username: Schema.String, response: Schema.Unknown } );
export const RegisterInput = Schema.Struct( {
	username: Schema.String,
	name: Schema.String,
	response: Schema.Unknown
} );

// --- API definition --------------------------------------------------------

export const AuthApiGroup = HttpApiGroup.make( "auth" ).prefix( "/auth" ).add(
	HttpApiEndpoint.get( "me", "/me", { success: Schema.NullOr( AuthInfoSchema ) } ),
	HttpApiEndpoint.post( "checkIfUserExists", "/auth/checkIfUserExists", {
		payload: UsernameInput,
		success: Schema.Boolean
	} ),
	HttpApiEndpoint.post( "getLoginOptions", "/getLoginOptions", {
		payload: UsernameInput,
		success: Schema.Unknown,
		error: HttpApiError.BadRequest
	} ),
	HttpApiEndpoint.post( "verifyLogin", "/verifyLogin", {
		payload: LoginInput,
		error: HttpApiError.BadRequest
	} ),
	HttpApiEndpoint.post( "getRegisterOptions", "/getRegisterOptions", {
		payload: RegisterOptionsInput,
		success: Schema.Unknown
	} ),
	HttpApiEndpoint.post( "verifyRegistration", "/verifyRegistration", {
		payload: RegisterInput,
		error: HttpApiError.BadRequest
	} ),
	HttpApiEndpoint.post( "logout", "/logout" )
);
