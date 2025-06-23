import { validateSessionToken } from "@/auth/server/functions";
import { handleLoginVerification, handleLogout, handleRegistrationVerification } from "@/auth/server/handlers";
import type { AuthInfo, Session } from "@/auth/types";
import { Document } from "@/document";
import { Home } from "@/routes";
import { CallbreakHome } from "@/routes/callbreak";
import { CallbreakGame } from "@/routes/callbreak.$gameId";
import { Settings } from "@/routes/settings";
import { WordleHome } from "@/routes/wordle";
import { WordleGame } from "@/routes/wordle.$gameId";
import { RootLayout } from "@/shared/components/root-layout";
import { createLogger } from "@/shared/utils/logger";
import { env } from "cloudflare:workers";
import { IS_DEV } from "rwsdk/constants";
import { realtimeRoute } from "rwsdk/realtime/worker";
import { layout, render, route, type RouteMiddleware } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

export { RealtimeDurableObject } from "rwsdk/realtime/durableObject";
export { WordleDurableObject } from "@/wordle/server/durable.object";

const logger = createLogger( "Worker" );

export type AppContext = {
	session?: Session;
	authInfo?: AuthInfo;
};

const setCommonHeaders = (): RouteMiddleware => ( { headers } ) => {
	if ( !IS_DEV ) {
		headers.set( "Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload" );
	}

	headers.set( "X-Content-Type-Options", "nosniff" );
	headers.set( "Referrer-Policy", "no-referrer" );
	headers.set( "Permissions-Policy", "geolocation=(), microphone=(), camera=()" );
};

const loadAuthInfo = (): RouteMiddleware => async ( { ctx, request } ) => {
	const { user, session } = await validateSessionToken( request );
	ctx.authInfo = user;
	ctx.session = session;
};

const requireAuthInfo = (): RouteMiddleware => ( { ctx } ) => {
	logger.info( "Require Auth Info Middleware Called" );
	if ( !ctx.authInfo ) {
		logger.warn( "Unauthorized Access Attempt" );
		return new Response( null, { status: 401, statusText: "Unauthorized" } );
	}

	return;
};

const verifyMethod = ( method: string ): RouteMiddleware => ( { request } ) => {
	if ( request.method !== method ) {
		logger.warn( `Method Not Allowed: Expected ${ method }, got ${ request.method }` );
		return new Response( null, { status: 405, statusText: "Method Not Allowed" } );
	}

	return;
};

export default defineApp( [
	setCommonHeaders(),
	loadAuthInfo(),
	realtimeRoute( () => env.REALTIME_DURABLE_OBJECT ),
	route( "/auth/logout", [ verifyMethod( "DELETE" ), handleLogout ] ),
	route( "/auth/registration", [ verifyMethod( "POST" ), handleRegistrationVerification ] ),
	route( "/auth/login", [ verifyMethod( "POST" ), handleLoginVerification ] ),
	render( Document, [
		layout( RootLayout, [
			route( "/", Home ),
			route( "/settings", Settings ),
			route( "/callbreak", CallbreakHome ),
			route( "/callbreak/:gameId", [ requireAuthInfo(), CallbreakGame ] ),
			route( "/wordle", WordleHome ),
			route( "/wordle/:gameId", [ requireAuthInfo(), WordleGame ] )
		] )
	] )
] );
