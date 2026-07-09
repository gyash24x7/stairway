import type { AuthInfo } from "@/auth/core/types";
import { db } from "@/shared/db/client";
import { sessions, users } from "@/shared/db/schema";
import { generateId } from "@/shared/utils/generator";
import { env } from "cloudflare:workers";
import * as cookie from "cookie";
import { and, eq, gt } from "drizzle-orm";

/** Name of the cookie carrying the signed session token. */
export const SESSION_COOKIE = "session";

/** Session lifetime in seconds (30 days). */
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

let cachedKey: CryptoKey | null = null;

/** Imports the HMAC signing key from the AUTH_SECRET_KEY secret (memoized per isolate). */
async function getSigningKey(): Promise<CryptoKey> {
	if ( cachedKey ) {
		return cachedKey;
	}

	cachedKey = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode( env.AUTH_SECRET_KEY ),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		[ "sign", "verify" ]
	);

	return cachedKey;
}

/** Encodes bytes as base64url without padding. */
function toBase64Url( bytes: ArrayBuffer ): string {
	const binary = String.fromCharCode( ...new Uint8Array( bytes ) );
	return btoa( binary ).replace( /\+/g, "-" ).replace( /\//g, "_" ).replace( /=+$/, "" );
}

/** Computes the base64url HMAC-SHA256 signature of a token. */
async function sign( token: string ): Promise<string> {
	const key = await getSigningKey();
	const signature = await crypto.subtle.sign( "HMAC", key, new TextEncoder().encode( token ) );
	return toBase64Url( signature );
}

/** Length-invariant comparison of two signatures. */
function safeEqual( a: string, b: string ): boolean {
	if ( a.length !== b.length ) {
		return false;
	}

	let mismatch = 0;
	for ( let i = 0; i < a.length; i++ ) {
		mismatch |= a.charCodeAt( i ) ^ b.charCodeAt( i );
	}
	return mismatch === 0;
}

/** Builds the signed cookie value `${token}.${signature}` for a session id. */
async function serializeToken( token: string ): Promise<string> {
	const signature = await sign( token );
	return `${ token }.${ signature }`;
}

/** Verifies a signed cookie value and returns the session token if the signature is valid. */
async function parseToken( value: string ): Promise<string | null> {
	const idx = value.lastIndexOf( "." );
	if ( idx <= 0 ) {
		return null;
	}

	const token = value.slice( 0, idx );
	const signature = value.slice( idx + 1 );
	const expected = await sign( token );
	return safeEqual( signature, expected ) ? token : null;
}

/**
 * Creates a new session row for a user and returns a signed `Set-Cookie` header value.
 * @param userId - The id of the user to create a session for.
 */
export async function createSession( userId: string ): Promise<string> {
	const token = generateId();
	const expiresAt = Math.floor( Date.now() / 1000 ) + SESSION_TTL_SECONDS;

	await db.insert( sessions ).values( { id: token, userId, expiresAt } );

	return cookie.serialize( {
		name: SESSION_COOKIE,
		value: await serializeToken( token ),
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_TTL_SECONDS
	} );
}

/**
 * Loads the authenticated user for a request's cookie header, or null if unauthenticated.
 * Verifies the cookie signature, looks up a non-expired session row, and joins the user.
 * @param cookieHeader - The raw `Cookie` request header.
 */
export async function loadSession( cookieHeader: string ): Promise<AuthInfo | null> {
	const value = cookie.parseCookie( cookieHeader )[ SESSION_COOKIE ];
	if ( !value ) {
		return null;
	}

	const token = await parseToken( value );
	if ( !token ) {
		return null;
	}

	const now = Math.floor( Date.now() / 1000 );
	const row = await db.query.sessions.findFirst( {
		where: and( eq( sessions.id, token ), gt( sessions.expiresAt, now ) )
	} );

	if ( !row ) {
		return null;
	}

	const user = await db.query.users.findFirst( { where: eq( users.id, row.userId ) } );
	if ( !user ) {
		return null;
	}

	return { id: user.id, name: user.name, username: user.username, avatar: user.avatar };
}

/**
 * Destroys the session referenced by a request's cookie and returns an expiring `Set-Cookie`.
 * @param cookieHeader - The raw `Cookie` request header.
 */
export async function destroySession( cookieHeader: string ): Promise<string> {
	const value = cookie.parseCookie( cookieHeader )[ SESSION_COOKIE ];
	if ( value ) {
		const token = await parseToken( value );
		if ( token ) {
			await db.delete( sessions ).where( eq( sessions.id, token ) );
		}
	}

	return cookie.serialize( {
		name: SESSION_COOKIE,
		value: "",
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/",
		maxAge: 0
	} );
}
