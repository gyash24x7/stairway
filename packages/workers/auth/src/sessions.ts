import type { AuthInfo, Session } from "@s2h/auth/types";
import { generateSecureRandomString } from "@s2h/utils/generator";
import { createLogger } from "@s2h/utils/logger";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import type { HonoCtx } from "./types.ts";

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
 * @param authInfo {AuthInfo} - Information about the authenticated user.
 * @param ctx {HonoCtx} - Hono context.
 */
export async function createSession( authInfo: AuthInfo, ctx: HonoCtx ) {
	logger.debug( ">> createSession()" );

	const sessionId = generateSecureRandomString();
	const session = { id: sessionId, authInfo, createdAt: Date.now() };
	await ctx.env.SESSION_KV.put( session.id, JSON.stringify( session ), { expirationTtl } );
	await setSignedCookie( ctx, "auth_session", session.id, ctx.env.AUTH_SECRET_KEY, cookieOptions );

	logger.debug( "<< createSession()" );
}

/**
 * Delete an existing session.
 * @param sessionId {string} - The ID of the session to delete.
 * @param ctx {HonoCtx} - Hono context.
 */
export async function deleteSession( sessionId: string, ctx: HonoCtx ) {
	await ctx.env.SESSION_KV.delete( sessionId );
	deleteCookie( ctx, "auth_session", cookieOptions );
}

/**
 * Validate the current session from the request cookies.
 * @param ctx {HonoCtx} - Hono context.
 * @returns {Promise<Session | undefined>} - The valid session or undefined if invalid/expired.
 */
export async function validateSession( ctx: HonoCtx ): Promise<Session | undefined> {
	logger.debug( ">> validateSession()" );

	const sessionId = await getSignedCookie( ctx, ctx.env.AUTH_SECRET_KEY, "auth_session" );
	if ( !sessionId ) {
		logger.warn( "Invalid Session Id!" );
		return undefined;
	}

	const session = await ctx.env.SESSION_KV.get<Session>( sessionId, { type: "json" } );
	if ( !session ) {
		logger.warn( "No Session Found!" );
		return undefined;
	}

	if ( Date.now() - session.createdAt >= 7 * 24 * 60 * 60 * 1000 ) {
		logger.warn( "Session Expired!" );
		await ctx.env.SESSION_KV.delete( session.id );
		return undefined;
	}

	logger.debug( "<< validateSession()" );
	return session;
}
