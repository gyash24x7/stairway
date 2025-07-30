import type { SessionParts } from "@/auth/types";
import { generateId } from "@/shared/utils/generator";
import { env } from "cloudflare:workers";

export const EXPIRATION_TTL = 60 * 60 * 24 * 30;
const COOKIE_NAME = "session_id";

function packSessionId( parts: SessionParts ) {
	return btoa( [ parts.unsignedSessionId, parts.signature ].join( ":" ) );
}

function unpackSessionId( packed: string ) {
	const [ unsignedSessionId, signature ] = atob( packed ).split( ":" );
	return { unsignedSessionId, signature } as SessionParts;
}

async function signSessionId( unsignedSessionId: string ) {
	const encoder = new TextEncoder();
	const secretKey = encoder.encode( env.AUTH_SECRET_KEY );
	const key = await crypto.subtle.importKey( "raw", secretKey, { name: "HMAC", hash: "SHA-256" }, false, [ "sign" ] );
	const signatureArrayBuffer = await crypto.subtle.sign( "HMAC", key, encoder.encode( unsignedSessionId ) );

	return Array.from( new Uint8Array( signatureArrayBuffer ) )
		.map( ( b ) => b.toString( 16 ).padStart( 2, "0" ) )
		.join( "" );
}

async function generateSessionId() {
	const unsignedSessionId = generateId();
	const signature = await signSessionId( unsignedSessionId );
	return packSessionId( { unsignedSessionId, signature } );
}

function saveSessionCookie( headers: Headers, sessionId: string, maxAge: number = EXPIRATION_TTL ) {
	const isViteDev = typeof import.meta.env !== "undefined" && import.meta.env.DEV;
	const sessionCookie = [
		`${ COOKIE_NAME }=${ sessionId };`,
		`Path=/; HttpOnly;`,
		`${ isViteDev ? "" : "Secure;" }`,
		`SameSite=Lax;`,
		`Max-Age=${ maxAge };`
	].join( " " );
	headers.set( "Set-Cookie", sessionCookie );
	return headers;
}

export async function isValidSessionId( sessionId: string ) {
	try {
		const { unsignedSessionId, signature } = unpackSessionId( sessionId );
		const computedSignature = await signSessionId( unsignedSessionId );
		return computedSignature === signature;
	} catch {
		return false;
	}
}

export function getSessionCookie( request: Request ) {
	const cookieHeader = request.headers.get( "Cookie" );
	if ( !cookieHeader ) {
		return undefined;
	}

	for ( const cookie of cookieHeader.split( ";" ) ) {
		const trimmedCookie = cookie.trim();
		const separatorIndex = trimmedCookie.indexOf( "=" );
		if ( separatorIndex === -1 ) {
			continue;
		}

		const key = trimmedCookie.slice( 0, separatorIndex );
		const value = trimmedCookie.slice( separatorIndex + 1 );
		if ( key === COOKIE_NAME ) {
			return value;
		}
	}

	return;
}

export async function createSessionCookie( userId: string ): Promise<Headers> {
	const sessionId = await generateSessionId();
	const session = { id: sessionId, userId, expiresAt: new Date( Date.now() + 1000 * EXPIRATION_TTL ) };
	await env.SESSION_KV.put( session.id, JSON.stringify( session ), { expirationTtl: EXPIRATION_TTL } );
	return saveSessionCookie( new Headers(), sessionId );
}