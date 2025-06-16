"use server";

import { type UsernameInput } from "@/auth/server/inputs";
import * as repository from "@/auth/server/repository";
import * as validators from "@/auth/server/validators";
import type { Passkey, Session } from "@/auth/types";
import { createLogger } from "@/shared/utils/logger";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { generateAuthenticationOptions, generateRegistrationOptions } from "@simplewebauthn/server";
import { env } from "cloudflare:workers";
import * as cookie from "cookie";

const logger = createLogger( "Auth:Functions" );

export async function checkIfUserExists( input: UsernameInput ) {
	const user = await repository.getUserByUsername( input.username );
	if ( !user ) {
		logger.warn( "User does not exist:", input.username );
		return false;
	}

	return true;
}

export async function getRegistrationOptions( { username }: UsernameInput ) {
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

export async function getLoginOptions( { username }: UsernameInput ) {
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