import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import {
	AuthenticationFailed,
	AuthInfo,
	CeremonyOptions,
	EmailTaken,
	RegisterInput,
	RegistrationFailed,
	VerifyInput
} from "@/auth/shared/schema.ts";


// --- Auth Api Group ---------------------------------------
// Passkey (WebAuthn) auth, owned in-app. Two ceremonies, each a
// begin (`/options`) + finish (`/verify`) round-trip; `verify` sets the session
// cookie. `me`/`logout` read and clear it. All endpoints are public (they
// establish the session); game groups sit behind `AuthMiddleware` instead.

const RegisterOptionsEndpoint = HttpApiEndpoint.post( "registerOptions", "/register/options", {
	payload: RegisterInput,
	success: CeremonyOptions,
	error: EmailTaken
} );

const RegisterVerifyEndpoint = HttpApiEndpoint.post( "registerVerify", "/register/verify", {
	payload: VerifyInput,
	success: AuthInfo,
	error: RegistrationFailed
} );

const LoginOptionsEndpoint = HttpApiEndpoint.post( "loginOptions", "/login/options", {
	success: CeremonyOptions
} );

const LoginVerifyEndpoint = HttpApiEndpoint.post( "loginVerify", "/login/verify", {
	payload: VerifyInput,
	success: AuthInfo,
	error: AuthenticationFailed
} );

const MeEndpoint = HttpApiEndpoint.get( "me", "/me", {
	success: Schema.NullOr( AuthInfo )
} );

const LogoutEndpoint = HttpApiEndpoint.post( "logout", "/logout", {
	success: Schema.Void
} );

export const AuthApiGroup = HttpApiGroup.make( "auth" )
	.add( RegisterOptionsEndpoint )
	.add( RegisterVerifyEndpoint )
	.add( LoginOptionsEndpoint )
	.add( LoginVerifyEndpoint )
	.add( MeEndpoint )
	.add( LogoutEndpoint )
	.prefix( "/auth" );
