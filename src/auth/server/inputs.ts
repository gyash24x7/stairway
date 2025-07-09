import { username } from "@/shared/utils/validation";
import { any, object, string } from "valibot";

export const usernameInput = object( {
	username: username()
} );

export const registrationVerificationInput = object( {
	username: username(),
	name: string(),
	response: any()
} );

export const loginVerificationInput = object( {
	username: username(),
	response: any()
} );
