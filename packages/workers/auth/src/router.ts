import { ORPCError, os, type RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { RequestHeadersPlugin, ResponseHeadersPlugin } from "@orpc/server/plugins";
import { createLogger } from "@s2h/utils/logger";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { drizzle } from "drizzle-orm/d1";
import { custom, minLength, object, pipe, string, trim } from "valibot";
import * as schema from "./schema.ts";
import { checkIfUserExists, getLoginOptions, getRegisterOptions, verifyLogin, verifyRegistration } from "./service.ts";
import { createSession, deleteSession, validateSession } from "./sessions.ts";
import type { InitialContext } from "./types.ts";

const logger = createLogger( "Auth:Router" );

const base = os.$context<InitialContext>().use( ( { context, next } ) => next( {
	context: {
		db: drizzle( context.env.DB, { schema } ),
		rpId: process.env[ "NODE_ENV" ] === "production" ? "stairway.yashgupta.me" : "localhost",
		rpOrigin: process.env[ "NODE_ENV" ] === "production"
			? "https://stairway.yashgupta.me"
			: "http://localhost:5173"
	}
} ) );

export const auth = base.router( {
	authInfo: base.handler( async ( { context } ) => {
		const session = await validateSession( context.env, context.reqHeaders );
		return { authInfo: session?.authInfo || null };
	} ),

	userExists: base
		.input( object( { username: pipe( string(), trim(), minLength( 3 ) ) } ) )
		.handler( async ( { input, context } ) => {
			const exists = await checkIfUserExists( input.username, context );
			return { exists };
		} ),

	logout: base.handler( async ( { context } ) => {
		const session = await validateSession( context.env, context.reqHeaders );
		if ( !session ) {
			logger.error( "No valid session found during logout." );
			throw new ORPCError( "UNAUTHORIZED", { message: "No valid session found." } );
		}

		context.resHeaders = await deleteSession( session.id, context.env, context.resHeaders );
	} ),

	registrationOptions: base
		.input( object( {
			username: pipe( string(), trim(), minLength( 3 ) ),
			name: pipe( string(), trim(), minLength( 3 ) )
		} ) )
		.handler( async ( { input, context } ) => getRegisterOptions( input, context ) ),

	verifyRegistration: base
		.input( object( {
			username: pipe( string(), trim(), minLength( 3 ) ),
			name: pipe( string(), trim(), minLength( 3 ) ),
			response: custom<RegistrationResponseJSON>( () => true )
		} ) )
		.handler( async ( { input, context } ) => {
			const authInfo = await verifyRegistration( input, context );
			context.resHeaders = await createSession( authInfo, context.env, context.resHeaders );
		} ),

	loginOptions: base
		.input( object( { username: pipe( string(), trim(), minLength( 3 ) ) } ) )
		.handler( async ( { input, context } ) => getLoginOptions( input, context ) ),

	verifyLogin: base
		.input( object( {
			username: pipe( string(), trim(), minLength( 3 ) ),
			response: custom<AuthenticationResponseJSON>( () => true )
		} ) )
		.handler( async ( { input, context } ) => {
			const authInfo = await verifyLogin( input, context );
			context.resHeaders = await createSession( authInfo, context.env, context.resHeaders );
		} )
} );

export const handler = new RPCHandler( auth, {
	plugins: [ new RequestHeadersPlugin(), new ResponseHeadersPlugin() ]
} );

export type AuthRouter = typeof auth;
export type AuthClient = RouterClient<AuthRouter>;
