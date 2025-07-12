import { validateSessionToken } from "@/auth/server/functions";
import { createLogger } from "@/shared/utils/logger";
import { IS_DEV } from "rwsdk/constants";
import type { RouteMiddleware } from "rwsdk/router";

const logger = createLogger( "Middlewares" );

export const setCommonHeaders = (): RouteMiddleware => ( { headers } ) => {
	if ( !IS_DEV ) {
		headers.set( "Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload" );
	}

	headers.set( "X-Content-Type-Options", "nosniff" );
	headers.set( "Referrer-Policy", "no-referrer" );
	headers.set( "Permissions-Policy", "geolocation=(), microphone=(), camera=()" );
};

export const loadAuthInfo = (): RouteMiddleware => async ( { ctx, request } ) => {
	const { user, session } = await validateSessionToken( request ).catch( err => {
		logger.error( "Failed to validate session token:", err );
		return { user: undefined, session: undefined };
	} );

	ctx.authInfo = user;
	ctx.session = session;
};

export const requireAuthInfo = (): RouteMiddleware => ( { ctx } ) => {
	logger.info( "Require Auth Info Middleware Called" );
	if ( !ctx.authInfo ) {
		logger.warn( "Unauthorized Access Attempt" );
		return new Response( null, { status: 401, statusText: "Unauthorized" } );
	}

	return;
};

export const verifyMethod = ( method: string ): RouteMiddleware => ( { request } ) => {
	if ( request.method !== method ) {
		logger.warn( `Method Not Allowed: Expected ${ method }, got ${ request.method }` );
		return new Response( null, { status: 405, statusText: "Method Not Allowed" } );
	}

	return;
};
