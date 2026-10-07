import * as Context from "effect/Context";
import * as Schema from "effect/Schema";

import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware";

import {
	AuthenticationFailed,
	CeremonyOptions,
	RegisterInput,
	RegistrationFailed,
	TooManyRequests,
	Unauthorized,
	User,
	UsernameTaken,
	VerifyInput
} from "@/auth/schema";


// --- Auth Endpoints ------------------------------------------------------------

const RegisterOptionsEndpoint = HttpApiEndpoint.post( "registerOptions", "/register/options", {
	payload: RegisterInput,
	success: CeremonyOptions,
	error: [ UsernameTaken, TooManyRequests ]
} );

const RegisterVerifyEndpoint = HttpApiEndpoint.post( "registerVerify", "/register/verify", {
	payload: VerifyInput,
	success: User,
	error: [ RegistrationFailed, TooManyRequests ]
} );

const LoginOptionsEndpoint = HttpApiEndpoint.post( "loginOptions", "/login/options", {
	success: CeremonyOptions,
	error: TooManyRequests
} );

const LoginVerifyEndpoint = HttpApiEndpoint.post( "loginVerify", "/login/verify", {
	payload: VerifyInput,
	success: User,
	error: [ AuthenticationFailed, TooManyRequests ]
} );

const MeEndpoint = HttpApiEndpoint.get( "me", "/me", {
	success: Schema.NullOr( User )
} );

const LogoutEndpoint = HttpApiEndpoint.post( "logout", "/logout", {
	success: Schema.Void
} );

const AuthApiGroup = HttpApiGroup.make( "auth" )
	.add( RegisterOptionsEndpoint )
	.add( RegisterVerifyEndpoint )
	.add( LoginOptionsEndpoint )
	.add( LoginVerifyEndpoint )
	.add( MeEndpoint )
	.add( LogoutEndpoint )
	.prefix( "/auth" );

export const AuthApi = HttpApi.make( "api" ).add( AuthApiGroup ).prefix( "/api" );


// --- Auth Context -------------------------------------------------------------

export class AuthContext extends Context.Service<AuthContext, User>()( "auth/Context" ) {}


// --- Auth Middleware -------------------------------------------------------------

export class AuthMiddleware extends HttpApiMiddleware.Service<
	AuthMiddleware,
	{ provides: AuthContext }
>()( "auth/Authorization", { error: Unauthorized } ) {}
