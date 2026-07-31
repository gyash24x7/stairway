import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";


// --- Session identity ----------------------------------------------------

export type AuthInfo = typeof AuthInfo.Type;
export const AuthInfo = Schema.TaggedStruct( "auth/Info", {
	id: Schema.String,
	name: Schema.String,
	avatar: Schema.String
} );

export type RegistrationFlow = typeof RegistrationFlow.Type;
export const RegistrationFlow = Schema.TaggedStruct( "auth/RegistrationFlow", {
	id: Schema.String,
	challenge: Schema.String,
	name: Schema.String,
	email: Schema.String
} );

export type LoginFlow = typeof LoginFlow.Type;
export const LoginFlow = Schema.TaggedStruct( "auth/LoginFlow", {
	...RegistrationFlow.mapFields( Struct.pick( [ "challenge", "id" ] ) ).fields
} );

export type AuthFlow = typeof AuthFlow.Type;
export const AuthFlow = Schema.Union( [ RegistrationFlow, LoginFlow ] );

export type RegisterInput = typeof RegisterInput.Type;
export const RegisterInput = Schema.Struct( {
	name: Schema.String,
	email: Schema.String
} );

export type CeremonyOptions = typeof CeremonyOptions.Type;
export const CeremonyOptions = Schema.Struct( {
	flowId: Schema.String,
	options: Schema.Any
} );

export type VerifyInput = typeof VerifyInput.Type;
export const VerifyInput = Schema.Struct( {
	flowId: Schema.String,
	response: Schema.Any
} );


// --- Errors --------------------------------------------------------------

export class Unauthorized extends Schema.TaggedErrorClass<Unauthorized>()(
	"auth/Unauthorized",
	{},
	{ httpApiStatus: 401 }
) {}

/** Registration rejected because the email already has an account. */
export class EmailTaken extends Schema.TaggedErrorClass<EmailTaken>()(
	"auth/EmailTaken",
	{ email: Schema.String },
	{ httpApiStatus: 409 }
) {}

/** The registration ceremony could not be verified (or the flow expired). */
export class RegistrationFailed extends Schema.TaggedErrorClass<RegistrationFailed>()(
	"auth/RegistrationFailed",
	{ reason: Schema.String },
	{ httpApiStatus: 400 }
) {}

/** The authentication ceremony could not be verified (or the flow expired). */
export class AuthenticationFailed extends Schema.TaggedErrorClass<AuthenticationFailed>()(
	"auth/AuthenticationFailed",
	{ reason: Schema.String },
	{ httpApiStatus: 401 }
) {}
