import { validateSessionToken } from "@/auth/server/functions";
import { createLogger } from "@/shared/utils/logger";
import type { RouteMiddleware } from "rwsdk/router";

const logger = createLogger( "Middlewares" );

export const setCommonHeaders = (): RouteMiddleware => ( { headers, rw } ) => {
	if ( !import.meta.env.VITE_IS_DEV_SERVER ) {
		headers.set( "Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload" );
	}

	headers.set( "X-Content-Type-Options", "nosniff" );
	headers.set( "Referrer-Policy", "no-referrer" );
	headers.set( "Permissions-Policy", "geolocation=(), microphone=(), camera=()" );

	const csps = [
		"default-src 'self'",
		`script-src 'self' 'nonce-${ rw.nonce }' https://challenges.cloudflare.com`,
		"style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
		"frame-src https://challenges.cloudflare.com",
		"object-src 'none'",
		"font-src https://fonts.gstatic.com",
		"img-src 'self' https://api.dicebear.com"
	];

	headers.set( "Content-Security-Policy", csps.join( "; " ) );
};

export const loadAuthInfo = (): RouteMiddleware => async ( { ctx, request } ) => {
	const { user, session } = await validateSessionToken( request ).catch( err => {
		logger.warn( "Failed to validate session token: %s", err.message );
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
