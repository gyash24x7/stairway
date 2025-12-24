import { ORPCError } from "@orpc/server";
import { generateAvatar, generateId } from "@s2h/utils/generator";
import { createLogger } from "@s2h/utils/logger";
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import { and, eq } from "drizzle-orm";
import * as schema from "./schema.ts";
import type {
	Context,
	NameInput,
	UsernameInput,
	VerifyLoginInput,
	VerifyRegistrationInput,
	WebauthnOptions
} from "./types.ts";

const logger = createLogger( "Auth:Service" );

/**
 * Check if a user exists by username
 * @param username - The username to check
 * @param ctx - The Orpc context
 * @returns True if the user exists, false otherwise
 */
export async function checkIfUserExists( username: string, ctx: Context ) {
	logger.debug( ">> userExists()" );
	const user = await ctx.db.query.users.findFirst( { where: eq( schema.users.username, username ) } );
	logger.debug( "<< userExists()" );
	return !!user;
}

/**
 * Get WebAuthn registration options for given name and username
 * @param input - The input containing username and name
 * @param ctx - The Orpc context
 * @returns The WebAuthn registration options
 */
export async function getRegisterOptions( input: UsernameInput & NameInput, ctx: Context ) {
	logger.debug( ">> getRegisterOptions()" );

	const options = await generateRegistrationOptions( {
		userDisplayName: input.name,
		rpID: ctx.rpId,
		rpName: "stairway",
		userName: input.username,
		attestationType: "none",
		authenticatorSelection: {
			residentKey: "preferred",
			userVerification: "preferred"
		}
	} );

	const webAuthnOptions = { challenge: options.challenge, webauthnUserId: options.user.id };
	await ctx.env.WEBAUTHN_KV.put( input.username, JSON.stringify( webAuthnOptions ) );
	logger.info( "Stored WebAuthn options in KV for user:", input.username );

	logger.debug( "<< getRegisterOptions()" );
	return options;
}

/**
 * Get WebAuthn login options for given username
 * @param input - The input containing username
 * @param ctx - The Orpc context
 * @returns The WebAuthn login options
 */
export async function getLoginOptions( { username }: UsernameInput, ctx: Context ) {
	logger.debug( ">> getLoginOptions()" );

	const user = await ctx.db.query.users.findFirst( { where: eq( schema.users.username, username ) } );
	if ( !user ) {
		logger.error( "User not found for username:", username );
		throw new ORPCError( "NOT_FOUND", { message: "User not found" } );
	}

	const options = await generateAuthenticationOptions( {
		rpID: ctx.rpId,
		userVerification: "preferred",
		allowCredentials: []
	} );

	const webAuthnOptions = { challenge: options.challenge };
	await ctx.env.WEBAUTHN_KV.put( username, JSON.stringify( webAuthnOptions ) );
	logger.info( "Stored WebAuthn options in KV for user:", username );

	logger.debug( "<< getLoginOptions()" );
	return options;
}

/**
 * Verify WebAuthn registration response
 * @param input - The input containing username, name, and response
 * @param ctx - The Orpc context
 * @returns The created user
 */
export async function verifyRegistration( input: VerifyRegistrationInput, ctx: Context ) {
	logger.debug( ">> verifyRegistration()" );

	const options = await getWebAuthnOptions( input.username, ctx );
	const verification = await verifyRegistrationResponse( {
		response: input.response,
		expectedChallenge: options.challenge,
		expectedRPID: ctx.rpId,
		expectedOrigin: ctx.rpOrigin
	} );

	if ( !verification.verified || !verification.registrationInfo ) {
		logger.error( "WebAuthn verification failed for user:", input.username );
		throw new ORPCError( "BAD_REQUEST", { message: "WebAuthn verification failed" } );
	}

	const [ user ] = await ctx.db.insert( schema.users )
		.values( { name: input.name, username: input.username, id: generateId(), avatar: generateAvatar() } )
		.returning();

	logger.info( "User created for WebAuthn registration:", user.id );

	await ctx.db.insert( schema.passkeys ).values( {
		id: verification.registrationInfo.credential.id,
		publicKey: verification.registrationInfo.credential.publicKey,
		userId: user.id,
		counter: verification.registrationInfo.credential.counter
	} );

	await ctx.env.WEBAUTHN_KV.delete( input.username );
	logger.info( "Deleted WebAuthn options from KV for user:", input.username );

	logger.debug( "<< verifyRegistration()" );
	return user;
}

/**
 * Verify WebAuthn login response
 * @param input - The input containing username and response
 * @param ctx - The Orpc context
 * @returns The authenticated user
 */
export async function verifyLogin( input: VerifyLoginInput, ctx: Context ) {
	logger.debug( ">> verifyLogin()" );

	const options = await getWebAuthnOptions( input.username, ctx );

	const user = await ctx.db.query.users.findFirst( { where: eq( schema.users.username, input.username ) } );
	if ( !user ) {
		logger.error( "User not found for username:", input.username );
		throw new ORPCError( "NOT_FOUND", { message: "User not found" } );
	}

	const passkey = await ctx.db.query.passkeys.findFirst( {
		where: and(
			eq( schema.passkeys.id, input.response.id ),
			eq( schema.passkeys.userId, user.id )
		)
	} );

	if ( !passkey ) {
		logger.error( "Passkey not found for user:", user.id, "with ID:", input.response.id );
		throw new ORPCError( "NOT_FOUND", { message: "Passkey not found for user" } );
	}

	logger.info( "Passkey exists for user:", user.id );

	const verification = await verifyAuthenticationResponse( {
		response: input.response,
		expectedChallenge: options.challenge,
		expectedOrigin: ctx.rpOrigin,
		expectedRPID: ctx.rpId,
		credential: {
			id: passkey.id,
			publicKey: passkey.publicKey,
			counter: passkey.counter
		}
	} );

	if ( !verification.verified || !verification.authenticationInfo ) {
		logger.error( "WebAuthn authentication verification failed for user:", user.username );
		throw new ORPCError( "BAD_REQUEST", { message: "WebAuthn authentication verification failed" } );
	}

	logger.info( "WebAuthn authentication verified for user:", user.username );

	await ctx.db.update( schema.passkeys )
		.set( { counter: verification.authenticationInfo.newCounter } )
		.where( eq( schema.passkeys.id, passkey.id ) );

	logger.info( "Passkey counter updated for user:", user.id );

	await ctx.env.WEBAUTHN_KV.delete( input.username );
	logger.info( "Deleted WebAuthn options from KV for user:", input.username );

	logger.debug( "<< verifyLogin()" );
	return user;
}

/**
 * Retrieve WebAuthn options from KV for given username
 * @param username - The username to retrieve options for
 * @param ctx - The Orpc context
 * @returns The WebAuthn options
 * @private
 */
async function getWebAuthnOptions( username: string, ctx: Context ) {
	logger.debug( ">> getWebAuthnOptions()" );

	const optionsJSON = await ctx.env.WEBAUTHN_KV.get( username );
	if ( !optionsJSON ) {
		logger.error( "No WebAuthn options found for username:", username );
		throw new ORPCError( "BAD_REQUEST", { message: "No WebAuthn options found for user" } );
	}

	const options = JSON.parse( optionsJSON ) as WebauthnOptions;
	logger.info( "Validated WebAuthn options for user:", username );

	logger.debug( "<< getWebAuthnOptions()" );
	return options;
}