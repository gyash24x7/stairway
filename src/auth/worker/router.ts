import { service } from "@/auth/worker/service";
import { createSession } from "@/auth/worker/sessions";
import { ORPCError, os } from "@orpc/server";
import { deleteCookie } from "@orpc/server/helpers";
import type {
	AuthenticationResponseJSON,
	PublicKeyCredentialCreationOptionsJSON,
	PublicKeyCredentialRequestOptionsJSON,
	RegistrationResponseJSON
} from "@simplewebauthn/server";
import { env } from "cloudflare:workers";
import { boolean, custom, minLength, nullable, object, pipe, string, trim, void_ } from "valibot";

const userExists = os.$context<Ctx>()
	.input( pipe( string(), trim(), minLength( 3 ) ) )
	.output( boolean() )
	.handler( ( { input } ) => service.userExists( input ) );

const authInfo = os.$context<Ctx>()
	.input( void_() )
	.output( object( {
		authInfo: nullable( object( {
			id: string(),
			name: string(),
			username: string(),
			avatar: string()
		} ) )
	} ) )
	.handler( ( { context } ) => ( { authInfo: context.session?.authInfo ?? null } ) );

const logout = os.$context<Ctx>().input( void_() ).output( void_() )
	.handler( async ( { context } ) => {
		if ( !context.session ) {
			throw new ORPCError( "FORBIDDEN" );
		}

		await env.SESSION_KV.delete( context.session.id );
		deleteCookie( context.resHeaders, "auth_session" );
	} );

const getRegistrationOptions = os.$context<Ctx>()
	.input( object( {
		username: pipe( string(), trim(), minLength( 3 ) ),
		name: pipe( string(), trim(), minLength( 3 ) )
	} ) )
	.output( custom<PublicKeyCredentialCreationOptionsJSON>( () => true ) )
	.handler( ( { input } ) => service.getRegistrationOptions( input ) );

const verifyRegistration = os.$context<Ctx>()
	.input( object( {
		username: pipe( string(), trim(), minLength( 3 ) ),
		name: pipe( string(), trim(), minLength( 3 ) ),
		response: custom<RegistrationResponseJSON>( () => true )
	} ) )
	.handler( async ( { input, context } ) => {
		const authInfo = await service.verifyRegistration( input );
		await createSession( authInfo, context.resHeaders );
	} );

const getLoginOptions = os.$context<Ctx>()
	.input( object( { username: pipe( string(), trim(), minLength( 3 ) ) } ) )
	.output( custom<PublicKeyCredentialRequestOptionsJSON>( () => true ) )
	.handler( ( { input } ) => service.getLoginOptions( input ) );

const verifyLogin = os.$context<Ctx>()
	.input( object( {
		username: pipe( string(), trim(), minLength( 3 ) ),
		response: custom<AuthenticationResponseJSON>( () => true )
	} ) )
	.handler( async ( { input, context } ) => {
		const authInfo = await service.verifyLogin( input );
		await createSession( authInfo, context.resHeaders );
	} );

export const router = {
	userExists,
	authInfo,
	logout,
	getRegistrationOptions,
	verifyRegistration,
	getLoginOptions,
	verifyLogin
};