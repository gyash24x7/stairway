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

/**
 * Handles the registration verification for WebAuthn.
 * This function processes the registration data, verifies it against the expected options,
 * creates a new passkey, and starts a user session.
 *
 * @param {RequestInfo} requestInfo - The request information containing the registration data.
 * @returns {Promise<Response>} Response indicating the result of the registration verification.
 */
export async function handleRegistrationVerification( { request }: RequestInfo ): Promise<Response> {
	return request.body!.getReader().read()
		.then( data => JSON.parse( new TextDecoder().decode( data.value ) ) )
		.then( data => parseAsync( registrationVerificationInput, data ) )
		.then( data => Promise.all( [
			validateWebAuthnOptions( data.username ),
			Promise.try( () => data )
		] ) )
		.then( ( [ options, data ] ) => Promise.all( [
			verifyRegistrationResponse( {
				response: data.response,
				expectedChallenge: options.challenge,
				expectedOrigin: env.APP_URL,
				expectedRPID: env.WEBAUTHN_RP_ID
			} ),
			Promise.resolve( { options, data } )
		] ) )
		.then( ( [ verification, { options, data } ] ) => {
			if ( !verification || !verification.verified || !verification.registrationInfo ) {
				logger.error( "WebAuthn registration verification failed for user:", data.username );
				throw "WebAuthn registration verification failed";
			}

			return Promise.all( [
				getOrCreateUser( data ),
				Promise.resolve( { options, data, verification } )
			] );
		} )
		.then( ( [ user, { verification, options } ] ) => createPasskey( {
			id: verification.registrationInfo!.credential.id,
			publicKey: verification.registrationInfo!.credential.publicKey,
			userId: user.id,
			webauthnUserId: options.webauthnUserId!,
			counter: verification.registrationInfo!.credential.counter,
			deviceType: verification.registrationInfo!.credentialDeviceType,
			backedUp: verification.registrationInfo!.credentialBackedUp ? 0 : 1,
			transports: verification.registrationInfo!.credential.transports
				? JSON.stringify( verification.registrationInfo!.credential.transports )
				: undefined
		} ) )
		.then( passkey => startSession( passkey.userId ) )
		.then( headers => {
			headers.set( "Location", "/" );
			return new Response( null, { status: 302, headers } );
		} )
		.catch( error => {
			logger.error( "WebAuthn registration verification failed:", error );
			throw new Response( "WebAuthn registration verification failed", { status: 400 } );
		} );
}

/**
 * Handles the login verification for WebAuthn.
 * This function processes the login data, verifies it against the expected options,
 * validates the passkey, and starts a user session.
 *
 * @param {RequestInfo} requestInfo - The request information containing the login data.
 * @returns {Promise<Response>}
 */
export async function handleLoginVerification( { request }: RequestInfo ): Promise<Response> {
	return request.body!.getReader().read()
		.then( data => JSON.parse( new TextDecoder().decode( data.value ) ) )
		.then( data => parseAsync( loginVerificationInput, data ) )
		.then( data => Promise.all( [
			validateWebAuthnOptions( data.username ),
			validateUserExists( data.username ),
			Promise.resolve( data )
		] ) )
		.then( ( [ options, user, data ] ) => Promise.all( [
			validatePasskeyExists( data.response.id, user.id ),
			Promise.resolve( { options, user, data } )
		] ) )
		.then( ( [ passkey, { options, data, user } ] ) => Promise.all( [
			verifyAuthenticationResponse( {
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
			} ),
			Promise.resolve( { options, data, user, passkey } )
		] ) )
		.then( ( [ verification, { user } ] ) => {
			if ( !verification || !verification.verified || !verification.authenticationInfo ) {
				logger.error( "WebAuthn authentication verification failed for user:", user.username );
				throw "WebAuthn authentication verification failed";
			}

			return startSession( user.id );
		} )
		.then( headers => {
			headers.set( "Location", "/" );
			return new Response( null, { status: 302, headers } );
		} )
		.catch( error => {
			logger.error( "WebAuthn login verification failed:", error );
			throw new Response( "WebAuthn login verification failed", { status: 400 } );
		} );
}

/**
 * Handles user logout by deleting the session from the KV store
 * and clearing the session cookie.
 *
 * @param {RequestInfo} requestInfo - The request information containing the session context.
 * @returns {Promise<Response>} Response indicating the result of the logout operation.
 */
export async function handleLogout( { ctx }: RequestInfo ): Promise<Response> {
	return env.SESSION_KV.delete( ctx.session!.id )
		.then( () => cookie.serialize( "session-id", "", {
			httpOnly: true,
			sameSite: "lax",
			secure: process.env[ "NODE_ENV" ] === "production",
			path: "/",
			maxAge: 0
		} ) )
		.then( sessionTokenCookie => {
			const headers = new Headers();
			headers.set( "Set-Cookie", sessionTokenCookie );
			headers.set( "Location", "/" );
			return new Response( null, { status: 302, headers } );
		} )
		.catch( err => {
			logger.error( "Error during logout:", err );
			return new Response( "Logout failed", { status: 500 } );
		} );
}

/**
 * Starts a new user session by generating a session token,
 * creating a session object, and storing it in the KV store.
 * This function also sets a cookie with the session token
 * to be sent to the client.
 *
 * @param {string} userId - The ID of the user for whom the session is being started.
 * @returns {Promise<Headers>} Headers containing the session cookie and other relevant headers.
 */
async function startSession( userId: string ): Promise<Headers> {
	const expirationTtl = 60 * 60 * 24 * 30;
	return Promise.try( () => generateSessionToken() )
		.then( token => [ encodeHexLowerCase( sha256( new TextEncoder().encode( token ) ) ), token ] )
		.then( ( [ sessionId, token ] ) => [
			{ id: sessionId, userId, expiresAt: new Date( Date.now() + 1000 * expirationTtl ) },
			token
		] as const )
		.then( ( [ session, token ] ) => Promise.all( [
			Promise.resolve( { session, token } ),
			env.SESSION_KV.put( session.id, JSON.stringify( session ), { expirationTtl } )
		] ) )
		.then( ( [ { session, token } ] ) => {
			const headers = new Headers();
			const sessionTokenCookie = cookie.serialize( "session-id", token, {
				httpOnly: true,
				sameSite: "lax",
				secure: process.env[ "NODE_ENV" ] === "production",
				expires: session.expiresAt,
				path: "/"
			} );

			headers.set( "Set-Cookie", sessionTokenCookie );
			logger.info( "Session started for user:", userId, "Session ID:", session.id );
			return headers;
		} );
}
