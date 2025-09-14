import { oc } from "@orpc/contract";
import type {
	AuthenticationResponseJSON,
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
	RegistrationResponseJSON
} from "@simplewebauthn/server";
import { boolean, custom, minLength, nullable, object, pipe, string, trim, void_ } from "valibot";

export const contract = {
	userExists: oc
		.input( pipe( string(), trim(), minLength( 3 ) ) )
		.output( object( { exists: boolean() } ) ),

	authInfo: oc
		.input( void_() )
		.output( nullable( object( {
			id: string(),
			name: string(),
			username: string(),
			avatar: string()
		} ) ) ),

	logout: oc.input( void_() ).output( void_() ),

	getRegistrationOptions: oc
		.input( object( {
			username: pipe( string(), trim(), minLength( 3 ) ),
			name: pipe( string(), trim(), minLength( 3 ) )
		} ) )
		.output( custom<PublicKeyCredentialCreationOptionsJSON>( () => true ) ),

	verifyRegistration: oc
		.input( object( {
			username: pipe( string(), trim(), minLength( 3 ) ),
			name: pipe( string(), trim(), minLength( 3 ) ),
			response: custom<RegistrationResponseJSON>( () => true )
		} ) )
		.output( void_() ),

	getLoginOptions: oc
		.input( object( { username: pipe( string(), trim(), minLength( 3 ) ) } ) )
		.output( custom<PublicKeyCredentialRequestOptionsJSON>( () => true ) ),

	verifyLogin: oc
		.input( object( {
			username: pipe( string(), trim(), minLength( 3 ) ),
			name: pipe( string(), trim(), minLength( 3 ) ),
			response: custom<AuthenticationResponseJSON>( () => true )
		} ) )
		.output( void_() )
};