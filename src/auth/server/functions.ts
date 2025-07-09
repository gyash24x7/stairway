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
 * Checks if a user exists by username.
 * @param {UsernameInput} input - The input containing the username to check.
 * @returns {Promise<boolean>} - Returns true if the user exists, false otherwise.
 */
export async function checkIfUserExists( input: UsernameInput ): Promise<boolean> {
	return parseAsync( usernameInput, input )
		.then( () => getUserByUsername( input.username ) )
		.then( ( user ) => !!user );
}

/**
 * Validates if a user exists and throws an error if not.
 * @param {UsernameInput} input - The input containing the username to validate.
 * @returns {Promise<DataResponse<PublicKeyCredentialCreationOptionsJSON>>} - Returns an error response if the user does not exist.
 * @throws {Error} - Throws an error if the user does not exist.
 */
export async function getRegistrationOptions( input: UsernameInput ): Promise<DataResponse<PublicKeyCredentialCreationOptionsJSON>> {
	return parseAsync( usernameInput, input )
		.then( () => getUserByUsername( input.username ) )
		.then( user => !user ? [] : getUserPasskeys( user.id ) )
		.then( existingPasskeys => generateRegistrationOptions( {
			rpID: env.WEBAUTHN_RP_ID,
			rpName: env.APP_NAME,
			userName: input.username,
			attestationType: "none",
			excludeCredentials: existingPasskeys.map( ( passkey ) => ( { id: passkey.id } ) ),
			authenticatorSelection: {
				residentKey: "preferred",
				userVerification: "preferred"
			}
		} ) )
		.then( ( options ) => [
			JSON.stringify( { challenge: options.challenge, webauthnUserId: options.user.id } ),
			options
		] as const )
		.then( ( [ data, options ] ) => Promise.all( [
			Promise.resolve( options ),
			env.WEBAUTHN_KV.put( input.username, data )
		] ) )
		.then( ( [ data ] ) => ( { error: undefined, data } ) )
		.catch( error => {
			logger.error( "Error generating registration options:", error );
			return { error: "Failed to generate registration options." };
		} );
}

/**
 * Generates login options for an existing user.
 * @param {UsernameInput} input - The input containing the username.
 * @returns {Promise<DataResponse<PublicKeyCredentialRequestOptionsJSON>>} - Returns the options for user login.
 */
export async function getLoginOptions( input: UsernameInput ): Promise<DataResponse<PublicKeyCredentialRequestOptionsJSON>> {
	return parseAsync( usernameInput, input )
		.then( () => validateUserExists( input.username ) )
		.then( existingUser => validatePasskeys( existingUser.id ) )
		.then( existingPasskeys => generateAuthenticationOptions( {
			rpID: env.WEBAUTHN_RP_ID,
			allowCredentials: existingPasskeys.map( ( passkey ) => ( {
				id: passkey.id,
				type: "public-key" as const,
				transports: passkey.transports ? JSON.parse( passkey.transports ) : undefined
			} ) )
		} ) )
		.then( options => [ JSON.stringify( { challenge: options.challenge } ), options ] as const )
		.then( ( [ data, options ] ) => env.WEBAUTHN_KV.put( input.username, data ).then( () => options ) )
		.then( options => ( { data: options } ) )
		.catch( error => {
			logger.error( "Error generating login options:", error );
			return { error: "Failed to generate login options." };
		} );
}

/**
 * Validates a session token from the request cookies.
 * @param {Request} request - The incoming request containing cookies.
 * @returns {Promise<SessionValidationResult>} - Returns the session and user if valid, otherwise undefined.
 */
export async function validateSessionToken( request: Request ): Promise<SessionValidationResult> {
	const expirationTtl = 60 * 60 * 24 * 30;
	return Promise.try( () => cookie.parse( request.headers.get( "Cookie" ) || "" ) )
		.then( cookies => cookies[ "session-id" ] )
		.then( token => {
			if ( !token ) {
				logger.debug( "No session token found in cookies" );
				throw "No session token found";
			}

			return encodeHexLowerCase( sha256( new TextEncoder().encode( token ) ) );
		} )
		.then( sessionId => env.SESSION_KV.get( sessionId ) )
		.then( v => v ? JSON.parse( v ) as Session : undefined )
		.then( session => {
			if ( !session ) {
				logger.debug( "No session found!" );
				throw "No session found";
			}

			return Promise.all( [
				Promise.resolve( session ),
				getUserById( session.userId )
			] );
		} )
		.then( ( [ session, user ] ) => {
			if ( !user ) {
				logger.debug( "No user found for session:", session.id );
				return env.SESSION_KV.delete( session.id ).then( () => Promise.reject( "No user found for session" ) );
			}

			const expiresAt = new Date( session.expiresAt );
			if ( Date.now() >= expiresAt.getTime() ) {
				logger.debug( "Session expired for token:", session.id );
				return env.SESSION_KV.delete( session.id ).then( () => Promise.reject( "Session expired" ) );
			}

			if ( Date.now() >= expiresAt.getTime() - 1000 * expirationTtl / 2 ) {
				session.expiresAt = new Date( Date.now() + 1000 * expirationTtl ).toISOString();
				return env.SESSION_KV.put( session.id, JSON.stringify( session ), { expirationTtl } )
					.then( () => ( { session, user } ) );
			}

			return { session, user };
		} )
		.catch( error => {
			logger.error( "Error validating session token:", error );
			return { session: undefined, user: undefined };
		} );
}