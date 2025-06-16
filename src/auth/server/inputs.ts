import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod/v4";

export const usernameInput = z.object( { username: z.string() } );

export type UsernameInput = z.infer<typeof usernameInput>;

export const registrationVerificationInput = z.object( {
	username: z.string(),
	name: z.string(),
	response: z.custom<RegistrationResponseJSON>()
} );

export type VerifyRegistrationInput = z.infer<typeof registrationVerificationInput>;

export const loginVerificationInput = z.object( {
	username: z.string(),
	response: z.custom<AuthenticationResponseJSON>()
} );

export type VerifyLoginInput = z.infer<typeof loginVerificationInput>;