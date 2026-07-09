import { base } from "@/api/orpc";
import { createSession, destroySession } from "@/auth/core/sessions";
import type { AuthInfo } from "@/auth/core/types";
import { db } from "@/shared/db/client";
import { passkeys, users, webauthnOptions } from "@/shared/db/schema";
import { generateAvatar, generateId } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { ORPCError } from "@orpc/server";
import {
	type AuthenticationResponseJSON,
	generateAuthenticationOptions,
	generateRegistrationOptions,
	type RegistrationResponseJSON,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";

const logger = createLogger( "Auth:Router" );

const getUserByUsername = async ( username: string ) => {
	return db.query.users.findFirst( { where: eq( users.username, username ) } );
};

const getWebAuthnOptions = async ( username: string ) => {
	return db.query.webauthnOptions.findFirst( {
		where: eq( webauthnOptions.username, username )
	} );
};

/** Returns the currently authenticated user, or null when unauthenticated. */
export const me = base.handler( ( { context } ): AuthInfo | null => context.user );

/** Checks if a user with the given username already exists. */
export const checkIfUserExists = base
	.input( v.object( { username: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ) } ) )
	.handler( async ( { input } ) => {
		const user = await getUserByUsername( input.username );
		return !!user;
	} );

/** Logs out the current user by destroying their session. */
export const logout = base.handler( async ( { context } ) => {
	const setCookie = await destroySession( context.req.headers.get( "Cookie" ) ?? "" );
	context.resHeaders.append( "Set-Cookie", setCookie );
} );

/** Generates WebAuthn authentication options for an existing user. */
export const getLoginOptions = base
	.input( v.object( { username: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ) } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> getLoginOptions()" );

		const user = await getUserByUsername( input.username );
		if ( !user ) {
			logger.error( "User not found for username:", input.username );
			throw new ORPCError( "BAD_REQUEST" );
		}

		const url = new URL( context.req.url );
		const options = await generateAuthenticationOptions( {
			rpID: url.hostname,
			userVerification: "preferred",
			allowCredentials: []
		} );

		await db.insert( webauthnOptions ).values( {
			username: input.username,
			challenge: options.challenge
		} );
		logger.info( "Saved WebAuthn options in DB for user:", input.username );

		logger.debug( "<< getLoginOptions()" );
		return options;
	} );

/** Verifies a WebAuthn authentication response and establishes a session. */
export const verifyLogin = base
	.input( v.object( {
		username: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ),
		response: v.custom<AuthenticationResponseJSON>( () => true )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> verifyLogin()" );

		const options = await getWebAuthnOptions( input.username );
		if ( !options ) {
			logger.error( "No WebAuthn options found for user:", input.username );
			throw new ORPCError( "BAD_REQUEST" );
		}

		const user = await getUserByUsername( input.username );
		if ( !user ) {
			logger.error( "User not found for username:", input.username );
			throw new ORPCError( "BAD_REQUEST" );
		}

		const passkey = await db.query.passkeys.findFirst( {
			where: and( eq( passkeys.id, input.response.id ), eq( passkeys.userId, user.id ) )
		} );

		if ( !passkey ) {
			logger.error( "Passkey not found for user:", user.id, "with ID:", input.response.id );
			throw new ORPCError( "BAD_REQUEST" );
		}

		const url = new URL( context.req.url );
		const verification = await verifyAuthenticationResponse( {
			response: input.response,
			expectedChallenge: options.challenge,
			expectedOrigin: url.origin,
			expectedRPID: url.hostname,
			credential: {
				id: passkey.id,
				publicKey: passkey.publicKey,
				counter: passkey.counter
			}
		} );

		if ( !verification.verified || !verification.authenticationInfo ) {
			logger.error( "WebAuthn authentication verification failed for user:", user.username );
			throw new ORPCError( "BAD_REQUEST" );
		}

		await db.update( passkeys )
			.set( { counter: verification.authenticationInfo.newCounter } )
			.where( eq( passkeys.id, passkey.id ) );

		await db.delete( webauthnOptions ).where( eq( webauthnOptions.username, user.username ) );

		context.resHeaders.append( "Set-Cookie", await createSession( user.id ) );

		logger.debug( "<< verifyLogin()" );
	} );

/** Generates WebAuthn registration options for a new user. */
export const getRegisterOptions = base
	.input( v.object( {
		username: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ),
		name: v.pipe( v.string(), v.trim(), v.minLength( 3 ) )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> getRegisterOptions()" );

		const url = new URL( context.req.url );
		const options = await generateRegistrationOptions( {
			userDisplayName: input.name,
			rpID: url.hostname,
			rpName: "stairway",
			userName: input.username,
			attestationType: "none",
			authenticatorSelection: {
				residentKey: "preferred",
				userVerification: "preferred"
			}
		} );

		await db.insert( webauthnOptions ).values( {
			username: input.username,
			challenge: options.challenge
		} );
		logger.info( "Saved WebAuthn options for user:", input.username );

		logger.debug( "<< getRegisterOptions()" );
		return options;
	} );

/** Verifies a WebAuthn registration, creates the user, and establishes a session. */
export const verifyRegistration = base
	.input( v.object( {
		username: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ),
		name: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ),
		response: v.custom<RegistrationResponseJSON>( () => true )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> verifyRegistration()" );

		const options = await getWebAuthnOptions( input.username );
		if ( !options ) {
			logger.error( "No WebAuthn options found for user:", input.username );
			throw new ORPCError( "BAD_REQUEST" );
		}

		const url = new URL( context.req.url );
		const verification = await verifyRegistrationResponse( {
			response: input.response,
			expectedChallenge: options.challenge,
			expectedRPID: url.hostname,
			expectedOrigin: url.origin
		} );

		if ( !verification.verified || !verification.registrationInfo ) {
			logger.error( "WebAuthn verification failed for user:", input.username );
			throw new ORPCError( "BAD_REQUEST" );
		}

		const user = {
			id: generateId(),
			name: input.name,
			username: input.username,
			avatar: generateAvatar()
		};
		await db.insert( users ).values( user );
		logger.info( "User created for WebAuthn registration:", user.id );

		await db.insert( passkeys ).values( {
			id: verification.registrationInfo.credential.id,
			publicKey: verification.registrationInfo.credential.publicKey,
			userId: user.id,
			counter: verification.registrationInfo.credential.counter
		} );

		await db.delete( webauthnOptions ).where( eq( webauthnOptions.username, input.username ) );

		context.resHeaders.append( "Set-Cookie", await createSession( user.id ) );

		logger.debug( "<< verifyRegistration()" );
	} );
