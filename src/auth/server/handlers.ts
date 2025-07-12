import { loginVerificationInput, registrationVerificationInput } from "@/auth/server/inputs";
import { createPasskey, getOrCreateUser } from "@/auth/server/repository";
import { validatePasskeyExists, validateUserExists, validateWebAuthnOptions } from "@/auth/server/validators";
import { generateSessionToken } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { verifyAuthenticationResponse, verifyRegistrationResponse } from "@simplewebauthn/server";
import { env } from "cloudflare:workers";
import * as cookie from "cookie";
import { TextDecoder } from "node:util";
import type { RequestInfo } from "rwsdk/worker";
import { parseAsync } from "valibot";

const logger = createLogger( "Auth:Handlers" );

export async function handleRegistrationVerification( { request }: RequestInfo ): Promise<Response> {
	try {
		const raw = await request.body!.getReader().read();
		const data = await parseAsync(
			registrationVerificationInput,
			JSON.parse( new TextDecoder().decode( raw.value ) )
		);
		logger.info( "Parsed registration verification input for user:", data.username );

		const options = await validateWebAuthnOptions( data.username );
		logger.info( "Validated WebAuthn options for user:", data.username );

		const verification = await verifyRegistrationResponse( {
			response: data.response,
			expectedChallenge: options.challenge,
			expectedOrigin: env.APP_URL,
			expectedRPID: env.WEBAUTHN_RP_ID
		} );

		if ( !verification || !verification.verified || !verification.registrationInfo ) {
			logger.error( "WebAuthn registration verification failed for user:", data.username );
			return new Response( "WebAuthn registration verification failed", { status: 400 } );
		}
		logger.info( "WebAuthn registration verified for user:", data.username );

		const user = await getOrCreateUser( data );
		logger.info( "User record found or created for:", data.username );

		const passkey = await createPasskey( {
			id: verification.registrationInfo.credential.id,
			publicKey: verification.registrationInfo.credential.publicKey,
			userId: user.id,
			webauthnUserId: options.webauthnUserId!,
			counter: verification.registrationInfo.credential.counter,
			deviceType: verification.registrationInfo.credentialDeviceType,
			backedUp: verification.registrationInfo.credentialBackedUp ? 0 : 1,
			transports: verification.registrationInfo.credential.transports
				? JSON.stringify( verification.registrationInfo.credential.transports )
				: undefined
		} );
		logger.info( "Passkey created for user:", user.id );

		const headers = await startSession( passkey.userId );
		headers.set( "Location", "/" );
		logger.info( "Session started and redirecting user:", user.id );

		return new Response( null, { status: 302, headers } );
	} catch ( error ) {
		logger.error( "WebAuthn registration verification failed:", error );
		return new Response( "WebAuthn registration verification failed", { status: 400 } );
	}
}

export async function handleLoginVerification( { request }: RequestInfo ): Promise<Response> {
	try {
		const raw = await request.body!.getReader().read();
		const data = await parseAsync( loginVerificationInput, JSON.parse( new TextDecoder().decode( raw.value ) ) );
		logger.info( "Parsed login verification input for user:", data.username );

		const options = await validateWebAuthnOptions( data.username );
		logger.info( "Validated WebAuthn options for user:", data.username );

		const user = await validateUserExists( data.username );
		logger.info( "User exists:", data.username );

		const passkey = await validatePasskeyExists( data.response.id, user.id );
		logger.info( "Passkey exists for user:", user.id );

		const verification = await verifyAuthenticationResponse( {
			response: data.response,
			expectedChallenge: options.challenge,
			expectedOrigin: env.APP_URL,
			expectedRPID: env.WEBAUTHN_RP_ID,
			credential: {
				id: passkey.id,
				publicKey: passkey.publicKey,
				counter: passkey.counter,
				transports: passkey.transports ? JSON.parse( passkey.transports ) : undefined
			}
		} );

		if ( !verification || !verification.verified || !verification.authenticationInfo ) {
			logger.error( "WebAuthn authentication verification failed for user:", user.username );
			return new Response( "WebAuthn authentication verification failed", { status: 400 } );
		}
		logger.info( "WebAuthn authentication verified for user:", user.username );

		const headers = await startSession( user.id );
		headers.set( "Location", "/" );
		logger.info( "Session started and redirecting user:", user.id );

		return new Response( null, { status: 302, headers } );
	} catch ( error ) {
		logger.error( "WebAuthn login verification failed:", error );
		return new Response( "WebAuthn login verification failed", { status: 400 } );
	}
}

export async function handleLogout( { ctx }: RequestInfo ): Promise<Response> {
	try {
		await env.SESSION_KV.delete( ctx.session!.id );
		logger.info( "Session deleted for user:", ctx.session!.id );

		const sessionTokenCookie = cookie.serialize( "session-id", "", {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env[ "NODE_ENV" ] === "production",
			path: "/",
			maxAge: 0
		} );

		const headers = new Headers();
		headers.set( "Set-Cookie", sessionTokenCookie );
		headers.set( "Location", "/" );
		logger.info( "Session cookie cleared and user redirected" );

		return new Response( null, { status: 302, headers } );
	} catch ( err ) {
		logger.error( "Error during logout:", err );
		return new Response( "Logout failed", { status: 500 } );
	}
}

async function startSession( userId: string ): Promise<Headers> {
	const expirationTtl = 60 * 60 * 24 * 30;
	const token = generateSessionToken();
	const sessionId = encodeHexLowerCase( sha256( new TextEncoder().encode( token ) ) );
	const session = {
		id: sessionId,
		userId,
		expiresAt: new Date( Date.now() + 1000 * expirationTtl )
	};

	await env.SESSION_KV.put( session.id, JSON.stringify( session ), { expirationTtl } );
	logger.info( "Session stored in KV for user:", userId );

	const headers = new Headers();
	const sessionTokenCookie = cookie.serialize( "session-id", token, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env[ "NODE_ENV" ] === "production",
		expires: session.expiresAt,
		path: "/"
	} );

	headers.set( "Set-Cookie", sessionTokenCookie );
	logger.info( "Session cookie set for user:", userId, "Session ID:", session.id );
	return headers;
}