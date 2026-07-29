import * as Schema from "effect/Schema";

export class UserNotFound extends Schema.TaggedErrorClass<UserNotFound>()(
	"auth/UserNotFound",
	{ username: Schema.String }
) {}

export class OptionsNotFound extends Schema.TaggedErrorClass<OptionsNotFound>()(
	"auth/OptionsNotFound",
	{ username: Schema.String }
) {}

export class PasskeyNotFound extends Schema.TaggedErrorClass<PasskeyNotFound>()(
	"auth/PasskeyNotFound",
	{ userId: Schema.String, passkeyId: Schema.String }
) {}

export class InvalidResponse extends Schema.TaggedErrorClass<InvalidResponse>()(
	"auth/InvalidResponse",
	{ username: Schema.String, response: Schema.Any }
) {}

export type VerifyLoginErrors = typeof VerifyLoginErrors.Type;
export const VerifyLoginErrors = Schema.Union( [
	InvalidResponse,
	OptionsNotFound,
	UserNotFound,
	PasskeyNotFound
] );

export type VerifyRegistrationErrors = typeof VerifyRegistrationErrors.Type;
export const VerifyRegistrationErrors = Schema.Union( [ InvalidResponse, OptionsNotFound ] );