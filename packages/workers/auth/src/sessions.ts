import { deleteCookie, getCookie, setCookie, sign, unsign } from "@orpc/server/helpers";
import type { AuthInfo, Session } from "@s2h/auth/types";
import { generateSecureRandomString } from "@s2h/utils/generator";
import { createLogger } from "@s2h/utils/logger";
import type { Bindings } from "./types.ts";

const expirationTtl = 7 * 24 * 60 * 60; // 7 days
const cookieOptions = {
	maxAge: expirationTtl,
	path: "/",
	httpOnly: true,
	secure: process.env[ "NODE_ENV" ] === "production"
};

const logger = createLogger( "Auth:Sessions" );

/**
 * Create a new session for the authenticated user.
 * @param authInfo - Information about the authenticated user.
 * @param env - Cloudflare Bindings.
 * @param headers - Optional headers to set the session cookie on.
 * @returns Headers with the session cookie set.
 */
export async function createSession( authInfo: AuthInfo, env: Bindings, headers = new Headers() ) {
	logger.debug( ">> createSession()" );

	const sessionId = generateSecureRandomString();
	const session = { id: sessionId, authInfo, createdAt: Date.now() };
	await env.SESSION_KV.put( session.id, JSON.stringify( session ), { expirationTtl } );

	const cookie = await sign( session.id, env.AUTH_SECRET_KEY );
	setCookie( headers, "auth_session", cookie, cookieOptions );

	logger.debug( "<< createSession()" );
	return headers;
}

/**
 * Delete an existing session.
 * @param sessionId - The ID of the session to delete.
 * @param env - Cloudflare Bindings.
 * @param headers - Optional headers to delete the session cookie from.
 * @returns Headers with deleted session cookie.
 */
export async function deleteSession( sessionId: string, env: Bindings, headers = new Headers() ) {
	await env.SESSION_KV.delete( sessionId );
	deleteCookie( headers, "auth_session", cookieOptions );
	return headers;
}

/**
 * Validate the current session from the request cookies.
 * @param env - Cloudflare Bindings.
 * @param headers - Headers containing the session cookie.
 * @returns The valid session or undefined if invalid/expired.
 */
export async function validateSession( env: Bindings, headers = new Headers() ): Promise<Session | undefined> {
	logger.debug( ">> validateSession()" );

	const signedCookie = getCookie( headers, "auth_session" );
	if ( !signedCookie ) {
		logger.warn( "No Session Cookie Found!" );
		return undefined;
	}

	const sessionId = await unsign( signedCookie, env.AUTH_SECRET_KEY );
	if ( !sessionId ) {
		logger.warn( "Invalid Session Id!" );
		return undefined;
	}

	const session = await env.SESSION_KV.get<Session>( sessionId, { type: "json" } );
	if ( !session ) {
		logger.warn( "No Session Found!" );
		return undefined;
	}

	if ( Date.now() - session.createdAt >= 7 * 24 * 60 * 60 * 1000 ) {
		logger.warn( "Session Expired!" );
		await env.SESSION_KV.delete( session.id );
		return undefined;
	}

	logger.debug( "<< validateSession()" );
	return session;
}
