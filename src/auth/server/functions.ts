"use server";

import { usernameInput } from "@/auth/server/inputs";
import { getUserById, getUserByUsername, getUserPasskeys } from "@/auth/server/repository";
import { validatePasskeys, validateUserExists } from "@/auth/server/validators";
import type { Session, SessionValidationResult, UsernameInput } from "@/auth/types";
import { createLogger } from "@/shared/utils/logger";
import { sha256 } from "@oslojs/crypto/sha2";
import { encodeHexLowerCase } from "@oslojs/encoding";
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	type PublicKeyCredentialCreationOptionsJSON,
	type PublicKeyCredentialRequestOptionsJSON
} from "@simplewebauthn/server";
import { env } from "cloudflare:workers";
import * as cookie from "cookie";
import { parseAsync } from "valibot";

const logger = createLogger( "Auth:Functions" );

/**
 * Checks if a user exists by validating their username.
 * This function retrieves the user by username and returns true if found,
 * otherwise returns false.
 *
 * @param {UsernameInput} input - The input containing the username.
 * @returns {Promise<boolean>} - True if the user exists, false otherwise.
 */
export async function checkIfUserExists( input: UsernameInput ): Promise<boolean> {
	try {
		await parseAsync( usernameInput, input );
		const user = await getUserByUsername( input.username );
		logger.info( "Checked if user exists:", input.username, !!user );
		return !!user;
	} catch ( error ) {
		logger.error( "Error checking if user exists:", error );
		return false;
	}
}

/**
 * Generates registration options for a user based on their username.
 * This function retrieves the user's passkeys and generates
 * WebAuthn registration options.
 * It stores the challenge in the KV store for later verification.
 *
 * @param {UsernameInput} input - The input containing the username.
 * @returns {Promise<DataResponse<PublicKeyCredentialCreationOptionsJSON>>} - Response containing the registration options or an error message.
 */
export async function getRegistrationOptions( input: UsernameInput ): Promise<DataResponse<PublicKeyCredentialCreationOptionsJSON>> {
	try {
		await parseAsync( usernameInput, input );
		const user = await getUserByUsername( input.username );
		if ( !user ) {
			logger.info( "No user found for registration options:", input.username );
			return { error: undefined, data: [] as any };
		}
		const existingPasskeys = await getUserPasskeys( user.id );
		const options = await generateRegistrationOptions( {
			rpID: env.WEBAUTHN_RP_ID,
			rpName: env.APP_NAME,
			userName: input.username,
			attestationType: "none",
			excludeCredentials: existingPasskeys.map( passkey => ( { id: passkey.id } ) ),
			authenticatorSelection: {
				residentKey: "preferred",
				userVerification: "preferred"
			}
		} );
		logger.info( "Generated registration options for user:", input.username );

		const data = JSON.stringify( { challenge: options.challenge, webauthnUserId: options.user.id } );
		await env.WEBAUTHN_KV.put( input.username, data );
		logger.info( "Stored registration challenge in KV for user:", input.username );

		return { error: undefined, data: options };
	} catch ( error ) {
		logger.error( "Error generating registration options:", error );
		return { error: "Failed to generate registration options." };
	}
}

/**
 * Generates login options for a user based on their username.
 * This function retrieves the user's passkeys and generates
 * WebAuthn authentication options.
 * It stores the challenge in the KV store for later verification.
 *
 * @param {UsernameInput} input - The input containing the username.
 * @returns {Promise<DataResponse<PublicKeyCredentialRequestOptionsJSON>>} - Response containing the login options or an error message.
 */
export async function getLoginOptions( input: UsernameInput ): Promise<DataResponse<PublicKeyCredentialRequestOptionsJSON>> {
	try {
		await parseAsync( usernameInput, input );
		const existingUser = await validateUserExists( input.username );
		const existingPasskeys = await validatePasskeys( existingUser.id );
		const options = await generateAuthenticationOptions( {
			rpID: env.WEBAUTHN_RP_ID,
			allowCredentials: existingPasskeys.map( passkey => ( {
				id: passkey.id,
				type: "public-key" as const,
				transports: passkey.transports ? JSON.parse( passkey.transports ) : undefined
			} ) )
		} );
		logger.info( "Generated login options for user:", input.username );

		const data = JSON.stringify( { challenge: options.challenge } );
		await env.WEBAUTHN_KV.put( input.username, data );
		logger.info( "Stored login challenge in KV for user:", input.username );

		return { data: options };
	} catch ( error ) {
		logger.error( "Error generating login options:", error );
		return { error: "Failed to generate login options." };
	}
}

/**
 * Validates the session token from the request cookies.
 * If the session is valid, it returns the session and user data.
 * If the session is expired or invalid, it throws an error.
 * This function also extends the session if it's about to expire within the next 15 days.
 *
 * @throws {Error} If the session token is not found.
 * @throws {Error} If no session is found for the token.
 * @throws {Error} If no user is found for the session.
 * @throws {Error} If the session has expired.
 *
 * @param {Request} request - The request object containing the cookies.
 * @returns {Promise<SessionValidationResult>} - An object containing the session and user data if the session is valid.
 */
export async function validateSessionToken( request: Request ): Promise<SessionValidationResult> {
	const expirationTtl = 60 * 60 * 24 * 30;
	const cookies = cookie.parse( request.headers.get( "Cookie" ) || "" );
	const token = cookies[ "session-id" ];
	if ( !token ) {
		logger.debug( "No session token found in cookies" );
		throw new Error( "No session token found" );
	}

	const sessionId = encodeHexLowerCase( sha256( new TextEncoder().encode( token ) ) );
	const v = await env.SESSION_KV.get( sessionId );
	const session = v ? ( JSON.parse( v ) as Session ) : undefined;
	if ( !session ) {
		logger.debug( "No session found!" );
		throw new Error( "No session found" );
	}

	const user = await getUserById( session.userId );
	if ( !user ) {
		logger.debug( "No user found for session:", session.id );
		await env.SESSION_KV.delete( session.id );
		throw new Error( "No user found for session" );
	}

	const expiresAt = new Date( session.expiresAt );
	if ( Date.now() >= expiresAt.getTime() ) {
		logger.debug( "Session expired for token:", session.id );
		await env.SESSION_KV.delete( session.id );
		throw new Error( "Session expired" );
	}

	if ( Date.now() >= expiresAt.getTime() - 1000 * expirationTtl / 2 ) {
		session.expiresAt = new Date( Date.now() + 1000 * expirationTtl ).toISOString();
		await env.SESSION_KV.put( session.id, JSON.stringify( session ), { expirationTtl } );
		logger.info( "Session extended for user:", user.id );
		return { session, user };
	}

	logger.info( "Session validated for user:", user.id );
	return { session, user };
}