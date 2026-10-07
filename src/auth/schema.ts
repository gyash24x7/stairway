import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import type {
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON
} from "@simplewebauthn/server";


// --- Auth Models ----------------------------------------------------

export type UserId = typeof UserId.Type;
export const UserId = Schema.String.check( Schema.isUUID( 7 ) ).pipe( Schema.brand( "UserId" ) );

export type User = typeof User.Type;
export const User = Schema.Struct( {
	id: UserId,
	name: Schema.NonEmptyString,
	username: Schema.NonEmptyString,
	avatar: Schema.NonEmptyString
} );

export type PasskeyId = typeof PasskeyId.Type;
export const PasskeyId = Schema.String.check( Schema.isUUID( 7 ) )
	.pipe( Schema.brand( "PasskeyId" ) );


// --- Ceremony Options ----------------------------------------------------------

export type RegisterOptions = PublicKeyCredentialCreationOptionsJSON;
export type LoginOptions = PublicKeyCredentialRequestOptionsJSON;


// --- Inputs --------------------------------------------------------------------

export type RegisterInput = typeof RegisterInput.Type;
export const RegisterInput = Schema.Struct( {
	name: Schema.NonEmptyString,
	username: Schema.NonEmptyString
} );

export type CeremonyOptions = typeof CeremonyOptions.Type;
export const CeremonyOptions = Schema.Struct( {
	flowId: Schema.NonEmptyString,
	options: Schema.Any
} );

export type VerifyInput = typeof VerifyInput.Type;
export const VerifyInput = Schema.Struct( {
	flowId: Schema.NonEmptyString,
	response: Schema.Any
} );


// --- Errors --------------------------------------------------------------------

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
	"auth/Unauthorized",
	{},
	{ httpApiStatus: 401 }
) {}

/** Registration rejected because the username already has an account. */
export class UsernameTaken extends Schema.TaggedError<UsernameTaken>()(
	"auth/UsernameTaken",
	{ username: Schema.String },
	{ httpApiStatus: 409 }
) {}

/** The registration ceremony could not be verified (or the flow expired). */
export class RegistrationFailed extends Schema.TaggedError<RegistrationFailed>()(
	"auth/RegistrationFailed",
	{ reason: Schema.String },
	{ httpApiStatus: 400 }
) {}

/** The authentication ceremony could not be verified (or the flow expired). */
export class AuthenticationFailed extends Schema.TaggedError<AuthenticationFailed>()(
	"auth/AuthenticationFailed",
	{ reason: Schema.String },
	{ httpApiStatus: 401 }
) {}

export class TooManyRequests extends Schema.TaggedError<TooManyRequests>()(
	"stairway/TooManyRequests",
	{ retryAfterSeconds: Schema.Int },
	{ httpApiStatus: 429 }
) {}


// --- Auth Flows -----------------------------------------------------------

export type RegistrationFlow = typeof RegistrationFlow.Type;
export const RegistrationFlow = Schema.TaggedStruct( "auth/RegistrationFlow", {
	id: Schema.NonEmptyString,
	challenge: Schema.NonEmptyString,
	name: Schema.NonEmptyString,
	username: Schema.NonEmptyString
} );

export type LoginFlow = typeof LoginFlow.Type;
export const LoginFlow = Schema.TaggedStruct( "auth/LoginFlow", {
	...RegistrationFlow.mapFields( Struct.pick( [ "challenge", "id" ] ) ).fields
} );

export type AuthFlow = typeof AuthFlow.Type;
export const AuthFlow = Schema.Union( [ RegistrationFlow, LoginFlow ] );
