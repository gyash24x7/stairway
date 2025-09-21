import type { AuthInfo, Session } from "@/auth/types";
import { generateSecureRandomString } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { getCookie, setCookie, sign, unsign } from "@orpc/server/helpers";
import { env } from "cloudflare:workers";

const expirationTtl = 7 * 24 * 60 * 60; // 7 days
const cookieOptions = {
	maxAge: expirationTtl,
	path: "/",
	httpOnly: true,
	secure: process.env.NODE_ENV === "production"
};

const logger = createLogger( "Sessions" );

export async function createSession( authInfo: AuthInfo, headers = new Headers() ) {
	logger.debug( ">> createSession()" );

	const sessionId = generateSecureRandomString();
	const session = { id: sessionId, authInfo, createdAt: Date.now() };
	await env.SESSION_KV.put( session.id, JSON.stringify( session ), { expirationTtl } );
	setCookie( headers, "auth_session", await sign( session.id, env.AUTH_SECRET_KEY ), cookieOptions );

	logger.debug( "<< createSession()" );
}

export async function validateSession( headers: Headers ) {
	logger.debug( ">> validateSession()" );

	const sessionCookie = getCookie( headers, "auth_session" );
	if ( !sessionCookie ) {
		logger.warn( "No Session Cookie!" );
		return undefined;
	}

	const sessionId = await unsign( sessionCookie, env.AUTH_SECRET_KEY );
	if ( !sessionId ) {
		logger.warn( "Invalid Session Id!" );
		return undefined;
	}

	const session = await env.SESSION_KV.get<Session>( sessionId, "json" );
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
