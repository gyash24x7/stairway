import { useAppSession } from "@/auth/core/sessions";
import { db } from "@/shared/db/client";
import { passkeys, users, webauthnOptions } from "@/shared/db/schema";
import { generateAvatar, generateId } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import {
	type AuthenticationResponseJSON,
	generateAuthenticationOptions,
	generateRegistrationOptions,
	type RegistrationResponseJSON,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";

const logger = createLogger( "Auth:Actions" );

const getUserByUsername = async ( username: string ) => {
	return db.query.users.findFirst( { where: eq( users.username, username ) } );
};

const getWebAuthnOptions = async ( username: string ) => {
	return db.query.webauthnOptions.findFirst( { where: eq( webauthnOptions.username, username ) } );
};

export const getAuthInfo = createServerFn( { method: "GET" } )
	.handler( async () => {
		const session = await useAppSession();
		if ( !session.data || !session.id || !session.data.authInfo ) {
			logger.warn( "Not Logged In!" );
			return null;
		}

		return session.data.authInfo;
	} );

export const checkIfUserExists = createServerFn( { method: "POST" } )
	.inputValidator( v.object( { username: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ) } ) )
	.handler( async ( { data: { username } } ) => {
		const user = await getUserByUsername( username );
		return !!user;
	} );

export const logout = createServerFn( { method: "POST" } )
	.handler( async () => {
		const session = await useAppSession();
		await session.clear();
		throw redirect( { to: "/" } );
	} );

export const getLoginOptions = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { username: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ) } ) )
	.handler( async ( { data: { username } } ) => {
		logger.debug( ">> getLoginOptions()" );

		const user = await getUserByUsername( username );
		if ( !user ) {
			logger.error( "User not found for username:", username );
			throw new Response( null, { status: 400 } );
		}

		const request = getRequest();
		const url = new URL( request.url );
		const options = await generateAuthenticationOptions( {
			rpID: url.hostname,
			userVerification: "preferred",
			allowCredentials: []
		} );

		await db.insert( webauthnOptions ).values( { username, challenge: options.challenge } );
		logger.info( "Saved WebAuthn options in DB for user:", username );

		logger.debug( "<< getLoginOptions()" );
		return options;
	} );

export const verifyLogin = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		username: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ),
		response: v.custom<AuthenticationResponseJSON>( () => true )
	} ) )
	.handler( async ( { data } ) => {
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
				eq( passkeys.userId, user.id ),
				eq( passkeys.id, data.response.id )
			)
		} );

		if ( !passkey ) {
			logger.error( "Passkey not found for user:", user.id, "with ID:", data.response.id );
			throw new Response( null, { status: 400 } );
		}

		logger.info( "Passkey exists for user:", user.id );

		const request = getRequest();
		const url = new URL( request.url );
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

		const session = await useAppSession();
		await session.update( { authInfo: user } );

		logger.debug( "<< verifyLogin()" );
		return user;
	} );

export const getRegisterOptions = createServerFn( { method: "GET" } )
	.inputValidator( v.object( {
		username: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ),
		name: v.pipe( v.string(), v.trim(), v.minLength( 3 ) )
	} ) )
	.handler( async ( { data: { username, name } } ) => {
		logger.debug( ">> getRegisterOptions()" );

		const request = getRequest();
		const url = new URL( request.url );
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
	} );

export const verifyRegistration = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		username: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ),
		name: v.pipe( v.string(), v.trim(), v.minLength( 3 ) ),
		response: v.custom<RegistrationResponseJSON>( () => true )
	} ) )
	.handler( async ( { data } ) => {
		logger.debug( ">> verifyRegistration()" );

		const options = await getWebAuthnOptions( data.username );
		if ( !options ) {
			logger.error( "No WebAuthn options found for user:", data.username );
			throw new Response( null, { status: 400 } );
		}

		const request = getRequest();
		const url = new URL( request.url );
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

		const session = await useAppSession();
		await session.update( { authInfo: user } );

		logger.debug( "<< verifyRegistration()" );
		return user;
	} );