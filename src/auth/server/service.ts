import type { VerifyLoginInput, VerifyRegistrationInput } from "@/auth/server/inputs";
import * as repository from "@/auth/server/repository";
import * as validators from "@/auth/server/validators";
import type { Passkey, Session } from "@/auth/types";
import { createLogger } from "@/shared/utils/logger";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ORPCError } from "@orpc/server";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeBase32LowerCaseNoPadding, encodeHexLowerCase } from "@oslojs/encoding";
import type { VerifiedAuthenticationResponse, VerifiedRegistrationResponse } from "@simplewebauthn/server";
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import { cookies } from "next/headers";

const logger = createLogger( "Auth:Service" );

export async function getWebAuthnRegistrationOptions( username: string ) {
	const ctx = await getCloudflareContext( { async: true } );
	let existingPasskeys: Passkey[] = [];

	const existingUser = await repository.getUserByUsername( username );
	if ( !!existingUser ) {
		logger.info( "Found existing user:", existingUser.username );
		existingPasskeys = await repository.getUserPasskeys( existingUser.id );
	}

	const options = await generateRegistrationOptions( {
		rpID: ctx.env.WEBAUTHN_RP_ID,
		rpName: ctx.env.APP_NAME,
		userName: username,
		attestationType: "none",
		excludeCredentials: existingPasskeys.map( ( passkey ) => ( { id: passkey.id } ) ),
		authenticatorSelection: {
			residentKey: "preferred",
			userVerification: "preferred"
		}
	} );

	await ctx.env.WEBAUTHN_KV.put(
		username,
		JSON.stringify( { challenge: options.challenge, webauthnUserId: options.user.id } )
	);

	return options;
}

export async function getWebAuthnLoginOptions( username: string ) {
	const ctx = await getCloudflareContext( { async: true } );
	const existingUser = await validators.validateUserExists( username );
	const existingPasskeys = await validators.validatePasskeys( existingUser.id );

	const options = await generateAuthenticationOptions( {
		rpID: ctx.env.WEBAUTHN_RP_ID,
		allowCredentials: existingPasskeys.map( ( passkey ) => ( {
			id: passkey.id,
			transports: passkey.transports ? JSON.parse( passkey.transports ) : undefined
		} ) )
	} );

	await ctx.env.WEBAUTHN_KV.put( username, JSON.stringify( { challenge: options.challenge } ) );

	return options;
}

export async function verifyWebAuthnRegistration( { username, name, response }: VerifyRegistrationInput ) {
	const ctx = await getCloudflareContext( { async: true } );
	const options = await validators.validateWebAuthnOptions( username );

	let verification: VerifiedRegistrationResponse | undefined = undefined;
	try {
		verification = await verifyRegistrationResponse( {
			response,
			expectedChallenge: options.challenge,
			expectedOrigin: ctx.env.APP_URL,
			expectedRPID: ctx.env.WEBAUTHN_RP_ID
		} );
	} catch ( error ) {
		logger.error( error );
	}

	if ( !verification || !verification.verified || !verification.registrationInfo ) {
		logger.error( "WebAuthn registration verification failed for user:", username );
		throw new ORPCError( "INVALID_REQUEST", { message: "WebAuthn registration verification failed" } );
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
	await setSessionTokenCookie( token, session.expiresAt );
}

export async function verifyWebAuthnLogin( { username, response }: VerifyLoginInput ) {
	const ctx = await getCloudflareContext( { async: true } );
	const options = await validators.validateWebAuthnOptions( username );
	const user = await validators.validateUserExists( username );
	const passkey = await validators.validatePasskeyExists( response.id, user.id );

	let verification: VerifiedAuthenticationResponse | undefined = undefined;
	try {
		verification = await verifyAuthenticationResponse( {
			response,
			expectedChallenge: options.challenge,
			expectedOrigin: origin,
			expectedRPID: ctx.env.WEBAUTHN_RP_ID,
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
		throw new ORPCError( "INVALID_REQUEST", { message: "WebAuthn authentication verification failed" } );
	}

	logger.info( "WebAuthn login verified for user:", username );
	const token = generateSessionToken();
	const session = await createSession( token, user.id );
	await setSessionTokenCookie( token, session.expiresAt );
}

export function generateSessionToken(): string {
	const bytes = new Uint8Array( 20 );
	crypto.getRandomValues( bytes );
	return encodeBase32LowerCaseNoPadding( bytes );
}

export async function createSession( token: string, userId: string ) {
	const ctx = await getCloudflareContext( { async: true } );
	const sessionId = encodeHexLowerCase( sha256( new TextEncoder().encode( token ) ) );
	const session = { id: sessionId, userId, expiresAt: new Date( Date.now() + 1000 * 60 * 60 * 24 * 30 ) };

	await ctx.env.SESSION_KV.put(
		sessionId,
		JSON.stringify( session ),
		{ expirationTtl: 60 * 60 * 24 * 30 }
	);

	return session;
}

export async function setSessionTokenCookie( token: string, expiresAt: Date ): Promise<void> {
	const cookieStore = await cookies();
	cookieStore.set( "session-id", token, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		expires: expiresAt,
		path: "/"
	} );
}

export async function validateSessionToken( token: string ) {
	const ctx = await getCloudflareContext( { async: true } );
	const sessionId = encodeHexLowerCase( sha256( new TextEncoder().encode( token ) ) );
	const session = await ctx.env.SESSION_KV.get( sessionId ).then( v => v ? JSON.parse( v ) as Session : null );

	if ( !session ) {
		logger.debug( "No session found for token:", token );
		return { session: null, user: null };
	}

	const user = await repository.getUserById( session.userId );
	if ( !user ) {
		logger.debug( "No user found for session:", sessionId );
		await ctx.env.SESSION_KV.delete( sessionId );
		return { session: null, user: null };
	}

	if ( Date.now() >= session.expiresAt.getTime() ) {
		logger.debug( "Session expired for token:", token );
		await ctx.env.SESSION_KV.delete( sessionId );
		return { session: null, user: null };
	}

	if ( Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15 ) {
		session.expiresAt = new Date( Date.now() + 1000 * 60 * 60 * 24 * 30 );
		await ctx.env.SESSION_KV.put(
			sessionId,
			JSON.stringify( session ),
			{ expirationTtl: 60 * 60 * 24 * 30 }
		);
	}

	return { session, user };
}

export async function invalidateSession( sessionId: string ) {
	const ctx = await getCloudflareContext( { async: true } );
	await ctx.env.SESSION_KV.delete( sessionId );
	logger.info( "Session invalidated:", sessionId );
	return true;
}
