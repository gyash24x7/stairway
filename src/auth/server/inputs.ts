import * as v from "valibot";

const username = () => v.pipe( v.string(), v.trim(), v.minLength( 3 ) );

export const usernameInput = v.object( {
	username: username()
} );

export type UsernameInput = v.InferOutput<typeof usernameInput>;

export const registrationVerificationInput = v.object( {
	username: username(),
	name: v.string(),
	response: v.any()
} );

export type VerifyRegistrationInput = v.InferOutput<typeof registrationVerificationInput>;

export const loginVerificationInput = v.object( {
	username: username(),
	response: v.any()
} );

export type VerifyLoginInput = v.InferOutput<typeof loginVerificationInput>;