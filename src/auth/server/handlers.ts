import type { VerifyLoginInput, VerifyRegistrationInput } from "@/auth/server/inputs";
import * as repository from "@/auth/server/repository";
import * as validators from "@/auth/server/validators";
import { createLogger } from "@/shared/utils/logger";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "@oslojs/encoding";
import {
	type VerifiedAuthenticationResponse,
	type VerifiedRegistrationResponse,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import { env } from "cloudflare:workers";
import * as cookie from "cookie";
import type { RequestInfo } from "rwsdk/worker";

const logger = createLogger( "Auth:Handlers" );

export async function handleRegistrationVerification( { request }: RequestInfo ) {
	const inputJson = new TextDecoder().decode( ( await request.body?.getReader().read() )?.value );
	const { username, name, response } = JSON.parse( inputJson ) as VerifyRegistrationInput;
	const options = await validators.validateWebAuthnOptions( username );

	let verification: VerifiedRegistrationResponse | undefined = undefined;
	try {
		verification = await verifyRegistrationResponse( {
			response,
			expectedChallenge: options.challenge,
			expectedOrigin: env.APP_URL,
			expectedRPID: env.WEBAUTHN_RP_ID
		} );
	} catch ( error ) {
		logger.error( error );
	}

	if ( !verification || !verification.verified || !verification.registrationInfo ) {
		logger.error( "WebAuthn registration verification failed for user:", username );
		throw "WebAuthn registration verification failed";
	}

	let user = await repository.getUserByUsername( username );
	if ( !user ) {
		logger.info( "Creating new user:", username );
		user = await repository.createUser( { username, name } );
	}

	await repository.createPasskey( {
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

	logger.info( "WebAuthn registration verified for user:", username );
	const headers = await startSession( user.id );
	headers.set( "Location", "/" );

	return new Response( null, { status: 302, headers } );
}

export async function handleLoginVerification( { request }: RequestInfo ) {
	const inputJson = new TextDecoder().decode( ( await request.body?.getReader().read() )?.value );
	const { username, response } = JSON.parse( inputJson ) as VerifyLoginInput;

	const options = await validators.validateWebAuthnOptions( username );
	const user = await validators.validateUserExists( username );
	const passkey = await validators.validatePasskeyExists( response.id, user.id );

	let verification: VerifiedAuthenticationResponse | undefined = undefined;
	try {
		verification = await verifyAuthenticationResponse( {
			response,
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
	} catch ( error ) {
		logger.error( error );
	}

	if ( !verification || !verification.verified || !verification.authenticationInfo ) {
		logger.error( "WebAuthn authentication verification failed for user:", username );
		throw "WebAuthn authentication verification failed";
	}

	logger.info( "WebAuthn login verified for user:", username );
	const headers = await startSession( user.id );
	headers.set( "Location", "/" );

	return new Response( null, { status: 302, headers } );
}

export async function handleLogout( { ctx }: RequestInfo ) {
	const headers = new Headers();

	await env.SESSION_KV.delete( ctx.session!.id );
	const sessionTokenCookie = cookie.serialize( "session-id", "", {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env[ "NODE_ENV" ] === "production",
		path: "/",
		maxAge: 0
	} );

	headers.set( "Set-Cookie", sessionTokenCookie );
	headers.set( "Location", "/" );
	return new Response( null, { status: 302, headers } );
}

async function startSession( userId: string ) {
	const headers = new Headers();
	const bytes = new Uint8Array( 20 );
	crypto.getRandomValues( bytes );

	const token = encodeBase32LowerCaseNoPadding( bytes );
	const sessionId = encodeHexLowerCase( sha256( new TextEncoder().encode( token ) ) );
	const session = { id: sessionId, userId, expiresAt: new Date( Date.now() + 1000 * 60 * 60 * 24 * 30 ) };

	await env.SESSION_KV.put(
		sessionId,
		JSON.stringify( session ),
		{ expirationTtl: 60 * 60 * 24 * 30 }
	);

	const sessionTokenCookie = cookie.serialize( "session-id", token, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env[ "NODE_ENV" ] === "production",
		expires: session.expiresAt,
		path: "/"
	} );

	headers.set( "Set-Cookie", sessionTokenCookie );
	logger.info( "Session started for user:", userId, "Session ID:", sessionId );
	return headers;
}
