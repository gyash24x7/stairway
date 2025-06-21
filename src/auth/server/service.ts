import type { VerifyLoginInput, VerifyRegistrationInput } from "@/auth/server/inputs";
import * as repository from "@/auth/server/repository";
import * as validators from "@/auth/server/validators";
import type { Passkey, Session } from "@/auth/types";
import { createLogger } from "@/shared/utils/logger";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "@oslojs/encoding";
import type { VerifiedAuthenticationResponse, VerifiedRegistrationResponse } from "@simplewebauthn/server";
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import { env } from "cloudflare:workers";
import * as cookie from "cookie";
import type { RequestInfo } from "rwsdk/worker";

const logger = createLogger( "Auth:Service" );

export async function getWebAuthnRegistrationOptions( username: string ) {
	let existingPasskeys: Passkey[] = [];

	const existingUser = await repository.getUserByUsername( username );
	if ( !!existingUser ) {
		logger.info( "Found existing user:", existingUser.username );
		existingPasskeys = await repository.getUserPasskeys( existingUser.id );
	}

	const options = await generateRegistrationOptions( {
		rpID: env.WEBAUTHN_RP_ID,
		rpName: env.APP_NAME,
		userName: username,
		attestationType: "none",
		excludeCredentials: existingPasskeys.map( ( passkey ) => ( { id: passkey.id } ) ),
		authenticatorSelection: {
			residentKey: "preferred",
			userVerification: "preferred"
		}
	} );

	await env.WEBAUTHN_KV.put(
		username,
		JSON.stringify( { challenge: options.challenge, webauthnUserId: options.user.id } )
	);

	return options;
}

export async function getWebAuthnLoginOptions( username: string ) {
	const existingUser = await validators.validateUserExists( username );
	const existingPasskeys = await validators.validatePasskeys( existingUser.id );

	const options = await generateAuthenticationOptions( {
		rpID: env.WEBAUTHN_RP_ID,
		allowCredentials: existingPasskeys.map( ( passkey ) => ( {
			id: passkey.id,
			transports: passkey.transports ? JSON.parse( passkey.transports ) : undefined
		} ) )
	} );

	await env.WEBAUTHN_KV.put( username, JSON.stringify( { challenge: options.challenge } ) );

	return options;
}

export async function verifyWebAuthnRegistration( { username, name, response }: VerifyRegistrationInput ) {
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
	const token = generateSessionToken();
	const session = await createSession( token, user.id );
	return { token, expiresAt: session.expiresAt };
}

export async function verifyWebAuthnLogin( { username, response }: VerifyLoginInput ) {
	const options = await validators.validateWebAuthnOptions( username );
	const user = await validators.validateUserExists( username );
	const passkey = await validators.validatePasskeyExists( response.id, user.id );

	let verification: VerifiedAuthenticationResponse | undefined = undefined;
	try {
		verification = await verifyAuthenticationResponse( {
			response,
			expectedChallenge: options.challenge,
			expectedOrigin: origin,
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
	const token = generateSessionToken();
	const session = await createSession( token, user.id );
	return { token, expiresAt: session.expiresAt };
}

export function generateSessionToken(): string {
	const bytes = new Uint8Array( 20 );
	crypto.getRandomValues( bytes );
	return encodeBase32LowerCaseNoPadding( bytes );
}

export async function createSession( token: string, userId: string ) {
	const sessionId = encodeHexLowerCase( sha256( new TextEncoder().encode( token ) ) );
	const session = { id: sessionId, userId, expiresAt: new Date( Date.now() + 1000 * 60 * 60 * 24 * 30 ) };

	await env.SESSION_KV.put(
		sessionId,
		JSON.stringify( session ),
		{ expirationTtl: 60 * 60 * 24 * 30 }
	);

	return session;
}

export async function validateSessionToken( request: Request ) {
	const cookies = cookie.parse( request.headers.get( "Cookie" ) || "" );
	const token = cookies[ "session-id" ];
	if ( !token ) {
		logger.debug( "No session token found in cookies" );
		return { session: undefined, user: undefined };
	}

	const sessionId = encodeHexLowerCase( sha256( new TextEncoder().encode( token ) ) );
	const session = await env.SESSION_KV.get( sessionId ).then( v => v ? JSON.parse( v ) as Session : undefined );

	if ( !session ) {
		logger.debug( "No session found for token:", token );
		return { session: undefined, user: undefined };
	}

	const expiresAt = new Date( session.expiresAt );
	const user = await repository.getUserById( session.userId );
	if ( !user ) {
		logger.debug( "No user found for session:", sessionId );
		await env.SESSION_KV.delete( sessionId );
		return { session: undefined, user: undefined };
	}

	if ( Date.now() >= expiresAt.getTime() ) {
		logger.debug( "Session expired for token:", token );
		await env.SESSION_KV.delete( sessionId );
		return { session: undefined, user: undefined };
	}

	if ( Date.now() >= expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15 ) {
		session.expiresAt = new Date( Date.now() + 1000 * 60 * 60 * 24 * 30 ).toISOString();
		await env.SESSION_KV.put(
			sessionId,
			JSON.stringify( session ),
			{ expirationTtl: 60 * 60 * 24 * 30 }
		);
	}

	return { session, user };
}

export async function invalidateSession( sessionId: string ) {
	await env.SESSION_KV.delete( sessionId );
	logger.info( "Session invalidated:", sessionId );
	return true;
}

export async function checkIfUserExists( username: string ) {
	const user = await repository.getUserByUsername( username );
	return !!user;
}

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
