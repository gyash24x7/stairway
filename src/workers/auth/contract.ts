import { usernameSchema } from "@/utils/schema";
import {
	authInfoSchema,
	getAuthOptionsInputSchema,
	loginOptionsSchema,
	registrationOptionsSchema,
	verifyLoginInputSchema,
	verifyRegistrationInputSchema
} from "@/workers/auth/schema";
import { oc } from "@orpc/contract";
import { boolean, nullable, object, void_ } from "valibot";

export const contract = {
	userExists: oc.input( usernameSchema() ).output( object( { exists: boolean() } ) ),
	authInfo: oc.input( void_() ).output( nullable( authInfoSchema ) ),
	logout: oc.input( void_() ).output( void_() ),
	getRegistrationOptions: oc.input( getAuthOptionsInputSchema ).output( registrationOptionsSchema ),
	verifyRegistration: oc.input( verifyRegistrationInputSchema ).output( void_() ),
	getLoginOptions: oc.input( getAuthOptionsInputSchema ).output( loginOptionsSchema ),
	verifyLogin: oc.input( verifyLoginInputSchema ).output( void_() )
};