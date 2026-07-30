import * as Schema from "effect/Schema";


// --- Schemas -------------------------------------------------------------

export type AuthInfo = typeof AuthInfo.Type;
export const AuthInfo = Schema.TaggedStruct( "auth/Info", {
	id: Schema.String,
	name: Schema.String,
	avatar: Schema.String
} );


// --- Inputs -------------------------------------------------------------

export type RegisterInput = typeof RegisterInput.Type;
export const RegisterInput = Schema.Struct( {
	name: Schema.String,
	email: Schema.String
} );


// --- Errors -------------------------------------------------------------

export class Unauthorized extends Schema.TaggedErrorClass<Unauthorized>()(
	"auth/Unauthorized",
	{},
	{ httpApiStatus: 401 }
) {}


