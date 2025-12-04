import { sValidator as validator } from "@hono/standard-validator";
import { createLogger } from "@s2h/utils/logger";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { custom, minLength, object, pipe, string, trim } from "valibot";
import * as schema from "./schema.ts";
import { getLoginOptions, getRegisterOptions, userExists, verifyLogin, verifyRegistration } from "./service.ts";
import { createSession, deleteSession, validateSession } from "./sessions.ts";
import type { HonoCtx, HonoEnv } from "./types.ts";

const logger = createLogger( "Auth:Router" );
const app = new Hono<HonoEnv>().basePath( "/auth" );

export function initializeContext( ctx: HonoCtx ) {
	ctx.set( "db", drizzle( ctx.env.DB, { schema } ) );
	ctx.set( "rpId", process.env[ "NODE_ENV" ] === "production" ? "stairway.yashgupta.me" : "localhost" );
	ctx.set(
		"rpOrigin",
		process.env[ "NODE_ENV" ] === "production" ? "https://stairway.yashgupta.me" : "http://localhost:5173"
	);
}

app.use( async ( ctx, next ) => {
	logger.debug( `>> ${ ctx.req.method } ${ ctx.req.url }` );
	initializeContext( ctx );
	await next();
	logger.debug( `<< ${ ctx.req.method } ${ ctx.req.url }` );
} );

app.get( "/info", async ctx => {
	const session = await validateSession( ctx );
	return ctx.json( { authInfo: session?.authInfo || null } );
} );

app.post(
	"/user/exists",
	validator( "json", object( {
		username: pipe( string(), trim(), minLength( 3 ) )
	} ) ),
	async ctx => {
		const exists = await userExists( ctx.req.valid( "json" ).username, ctx );
		return ctx.json( { exists } );
	}
);

app.delete( "/logout", async ctx => {
	const session = await validateSession( ctx );
	if ( !session ) {
		logger.error( "No valid session found during logout." );
		throw new HTTPException( 401, { message: "No valid session found." } );
	}

	await deleteSession( session.id, ctx );
	return ctx.body( null, 204 );
} );

app.post(
	"/registration/options",
	validator( "json", object( {
		username: pipe( string(), trim(), minLength( 3 ) ),
		name: pipe( string(), trim(), minLength( 3 ) )
	} ) ),
	async ctx => {
		const options = await getRegisterOptions( ctx.req.valid( "json" ), ctx );
		return ctx.json( options );
	}
);

app.post(
	"/registration/verify",
	validator( "json", object( {
		username: pipe( string(), trim(), minLength( 3 ) ),
		name: pipe( string(), trim(), minLength( 3 ) ),
		response: custom<RegistrationResponseJSON>( () => true )
	} ) ),
	async ctx => {
		const authInfo = await verifyRegistration( ctx.req.valid( "json" ), ctx );
		await createSession( authInfo, ctx );
		return ctx.body( null, 204 );
	}
);

app.post(
	"/login/options",
	validator( "json", object( {
		username: pipe( string(), trim(), minLength( 3 ) )
	} ) ),
	async ctx => {
		const options = await getLoginOptions( ctx.req.valid( "json" ), ctx );
		return ctx.json( options );
	}
);

app.post(
	"/login/verify",
	validator( "json", object( {
		username: pipe( string(), trim(), minLength( 3 ) ),
		response: custom<AuthenticationResponseJSON>( () => true )
	} ) ),
	async ctx => {
		const authInfo = await verifyLogin( ctx.req.valid( "json" ), ctx );
		await createSession( authInfo, ctx );
		return ctx.body( null, 204 );
	}
);

export const auth = app;