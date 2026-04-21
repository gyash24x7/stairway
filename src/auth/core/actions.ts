"use server";

import { sessionStore } from "@/auth/core/sessions";
import type { NameInput, UsernameInput, VerifyLoginInput, VerifyRegistrationInput } from "@/auth/core/types";
import { db } from "@/shared/db/client";
import { passkeys, users, webauthnOptions } from "@/shared/db/schema";
import { generateAvatar, generateId } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { validate } from "@/shared/utils/middlewares";
import {
	type AuthenticationResponseJSON,
	generateAuthenticationOptions,
	generateRegistrationOptions,
	type RegistrationResponseJSON,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import { and, eq } from "drizzle-orm";
import { requestInfo, serverAction, serverQuery } from "rwsdk/worker";
import * as v from "valibot";

const logger = createLogger( "Auth:Actions" );

const getUserByUsername = async ( username: string ) => {
	return db.query.users.findFirst( { where: eq( users.username, username ) } );
};

const getWebAuthnOptions = async ( username: string ) => {
	return db.query.webauthnOptions.findFirst( { where: eq( webauthnOptions.username, username ) } );
};

export const checkIfUserExists = serverAction( [
	validate( v.object( { username: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ) } ) ),
	async ( { username }: UsernameInput ) => {
		const user = await getUserByUsername( username );
		return !!user;
	}
] );

export const logout = serverAction( async () => {
	await sessionStore.remove( requestInfo.request, requestInfo.response.headers );
} );

export const getLoginOptions = serverQuery( [
	validate( v.object( { username: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ) } ) ),
	async ( { username }: UsernameInput ) => {
		logger.debug( ">> getLoginOptions()" );

		const user = await getUserByUsername( username );
		if ( !user ) {
			logger.error( "User not found for username:", username );
			throw new Response( null, { status: 400 } );
		}

		const url = new URL( requestInfo.request.url );
		const options = await generateAuthenticationOptions( {
			rpID: url.hostname,
			userVerification: "preferred",
			allowCredentials: []
		} );

		await db.insert( webauthnOptions ).values( { username, challenge: options.challenge } );
		logger.info( "Saved WebAuthn options in DB for user:", username );

		logger.debug( "<< getLoginOptions()" );
		return options;
	}
] );

export const verifyLogin = serverAction( [
	validate( v.object( {
		username: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ),
		response: v.custom<AuthenticationResponseJSON>( () => true )
	} ) ),
	async ( data: VerifyLoginInput ) => {
		logger.debug( ">> verifyLogin()" );

		const options = await getWebAuthnOptions( data.username );
		if ( !options ) {
			logger.error( "No WebAuthn options found for user:", data.username );
			throw new Response( null, { status: 400 } );
		}

		const user = await getUserByUsername( data.username );
		if ( !user ) {
			logger.error( "User not found for username:", data.username );
			throw new Response( null, { status: 400 } );
		}

		const passkey = await db.query.passkeys.findFirst( {
			where: and(
				eq( passkeys.id, data.response.id ),
				eq( passkeys.userId, user.id )
			)
		} );

		if ( !passkey ) {
			logger.error( "Passkey not found for user:", user.id, "with ID:", data.response.id );
			throw new Response( null, { status: 400 } );
		}

		logger.info( "Passkey exists for user:", user.id );

		const url = new URL( requestInfo.request.url );
		const verification = await verifyAuthenticationResponse( {
			response: data.response,
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
			throw new Response( null, { status: 400 } );
		}

		logger.info( "WebAuthn authentication verified for user:", user.username );

		await db.update( passkeys )
			.set( { counter: verification.authenticationInfo.newCounter } )
			.where( eq( passkeys.id, passkey.id ) );

		logger.info( "Passkey counter updated for user:", user.id );

		await db.delete( webauthnOptions ).where( eq( webauthnOptions.username, user.username ) );
		logger.info( "Deleted WebAuthn options from KV for user:", data.username );

		await sessionStore.save( requestInfo.response.headers, { authInfo: user } );

		logger.debug( "<< verifyLogin()" );
	}
] );

export const getRegisterOptions = serverQuery( [
	validate( v.object( {
		username: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ),
		name: v.pipe( v.string(), v.trim(), v.minLength( 3 ) )
	} ) ),
	async ( { username, name }: UsernameInput & NameInput ) => {
		logger.debug( ">> getRegisterOptions()" );

		const url = new URL( requestInfo.request.url );
		const options = await generateRegistrationOptions( {
			userDisplayName: name,
			rpID: url.hostname,
			rpName: "stairway",
			userName: username,
			attestationType: "none",
			authenticatorSelection: {
				residentKey: "preferred",
				userVerification: "preferred"
			}
		} );

		await db.insert( webauthnOptions ).values( { username, challenge: options.challenge } );
		logger.info( "Saved WebAuthn options for user:", username );

		logger.debug( "<< getRegisterOptions()" );
		return options;
	}
] );

export const verifyRegistration = serverAction( [
	validate( v.object( {
		username: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ),
		name: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ),
		response: v.custom<RegistrationResponseJSON>( () => true )
	} ) ),

	async ( data: VerifyRegistrationInput ) => {
		logger.debug( ">> verifyRegistration()" );

		const options = await getWebAuthnOptions( data.username );
		if ( !options ) {
			logger.error( "No WebAuthn options found for user:", data.username );
			throw new Response( null, { status: 400 } );
		}

		const url = new URL( requestInfo.request.url );
		const verification = await verifyRegistrationResponse( {
			response: data.response,
			expectedChallenge: options.challenge,
			expectedRPID: url.hostname,
			expectedOrigin: url.origin
		} );

		if ( !verification.verified || !verification.registrationInfo ) {
			logger.error( "WebAuthn verification failed for user:", data.username );
			throw new Response( null, { status: 400 } );
		}

		const user = { id: generateId(), name: data.name, username: data.username, avatar: generateAvatar() };
		await db.insert( users ).values( user );
		logger.info( "User created for WebAuthn registration:", user.id );

		await db.insert( passkeys ).values( {
			id: verification.registrationInfo.credential.id,
			publicKey: verification.registrationInfo.credential.publicKey,
			userId: user.id,
			counter: verification.registrationInfo.credential.counter
		} );

		await db.delete( webauthnOptions ).where( eq( webauthnOptions.username, data.username ) ).execute();
		logger.info( "Deleted WebAuthn options for user:", data.username );

		await sessionStore.save( requestInfo.response.headers, { authInfo: user } );

		logger.debug( "<< verifyRegistration()" );
	}
] );