"use server";

import { createPasskey, createUser, getPasskey, getUserByUsername, getUserPasskeys } from "@/auth/server/service";
import type { Passkey } from "@/auth/types";
import { createLogger } from "@/shared/utils/logger";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
	type AuthenticationResponseJSON,
	generateAuthenticationOptions,
	generateRegistrationOptions,
	type RegistrationResponseJSON,
	type VerifiedAuthenticationResponse,
	type VerifiedRegistrationResponse,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const logger = createLogger( "Auth:Functions" );

const kv = new Map<string, { webauthnUserId?: string; challenge: string }>();

export async function getWebAuthnRegistrationOptions( username: string ) {
	let existingPasskeys: Passkey[] = [];

	const existingUser = await getUserByUsername( username );
	if ( !!existingUser ) {
		existingPasskeys = await getUserPasskeys( existingUser.id );
	}

	const ctx = await getCloudflareContext( { async: true } );
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

	kv.set( username, { challenge: options.challenge, webauthnUserId: options.user.id } );

	return options;
}

export async function verifyWebAuthnRegistration( username: string, name: string, response: RegistrationResponseJSON ) {
	const registrationOptions = kv.get( username );
	if ( !registrationOptions ) {
		logger.error( "No registration options found for username:", username );
		throw new Error( "No registration options found" );
	}

	const ctx = await getCloudflareContext( { async: true } );
	let verification: VerifiedRegistrationResponse | undefined = undefined;
	try {
		verification = await verifyRegistrationResponse( {
			response,
			expectedChallenge: registrationOptions.challenge,
			expectedOrigin: ctx.env.APP_URL,
			expectedRPID: ctx.env.WEBAUTHN_RP_ID
		} );
	} catch ( error ) {
		logger.error( error );
	}

	if ( !!verification && verification?.verified && verification.registrationInfo ) {
		logger.info( "WebAuthn registration verified for user:", username );

		let user = await getUserByUsername( username );
		if ( !user ) {
			user = await createUser( { username, name } );
		}

		await createPasskey( {
			id: verification.registrationInfo.credential.id,
			publicKey: verification.registrationInfo.credential.publicKey,
			userId: user.id,
			webauthnUserId: registrationOptions.webauthnUserId!,
			counter: verification.registrationInfo.credential.counter,
			deviceType: verification.registrationInfo.credentialDeviceType,
			backedUp: verification.registrationInfo.credentialBackedUp ? 0 : 1,
			transports: verification.registrationInfo.credential.transports
				? JSON.stringify( verification.registrationInfo.credential.transports )
				: undefined
		} );
	}
}

export async function getWebAuthnLoginOptions( username: string ) {
	const existingUser = await getUserByUsername( username );
	if ( !existingUser ) {
		logger.error( "User not found:", username );
		throw new Error( "User not found" );
	}

	const existingPasskeys = await getUserPasskeys( existingUser.id );
	if ( existingPasskeys.length === 0 ) {
		logger.error( "No passkeys found for user:", username );
		throw new Error( "No passkeys found" );
	}

	const ctx = await getCloudflareContext( { async: true } );
	const options = await generateAuthenticationOptions( {
		rpID: ctx.env.WEBAUTHN_RP_ID,
		allowCredentials: existingPasskeys.map( ( passkey ) => ( {
			id: passkey.id,
			transports: passkey.transports ? JSON.parse( passkey.transports ) : undefined
		} ) )
	} );

	kv.set( username, { challenge: options.challenge } );

	return options;
}

export async function verifyWebAuthnLogin( username: string, response: AuthenticationResponseJSON ) {
	const loginOptions = kv.get( username );
	if ( !loginOptions ) {
		logger.error( "No login options found for username:", username );
		throw new Error( "No login options found" );
	}

	const existingUser = await getUserByUsername( username );
	if ( !existingUser ) {
		logger.error( "User not found:", username );
		throw new Error( "User not found" );
	}

	const passkey = await getPasskey( response.id, existingUser.id );
	if ( !passkey ) {
		logger.error( "Passkey not found for user:", username );
		throw new Error( "Passkey not found" );
	}

	const ctx = await getCloudflareContext( { async: true } );
	let verification: VerifiedAuthenticationResponse | undefined = undefined;
	try {
		verification = await verifyAuthenticationResponse( {
			response,
			expectedChallenge: loginOptions.challenge,
			expectedOrigin: ctx.env.APP_URL,
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

	if ( !!verification && verification?.verified && verification.authenticationInfo ) {
		logger.info( "WebAuthn login verified for user:", username );
		return verification.authenticationInfo;
	}

	throw new Error( "WebAuthn login verification failed" );
}

export async function getAuthInfo() {
	// const cookieStore = await cookies();
	// const sessionId = cookieStore.get( "session-id" );
	//
	// if ( !sessionId?.value ) {
	// 	logger.debug( "No Session Id Cookie!" );
	// 	return undefined;
	// }
	//
	// const session = await getSession( sessionId.value );
	// if ( !session ) {
	// 	logger.debug( "No Session for session id!" );
	// 	return undefined;
	// }
	//
	// if ( !session.username ) {
	// 	logger.debug( "No Username present in session!" );
	// 	return undefined;
	// }
	//
	// const user = await getUserByUsername( session.username );
	// if ( !user ) {
	// 	logger.debug( "User not found!" );
	// 	return undefined;
	// }

	logger.debug( origin );

	return undefined;
}

export async function logout() {
	const cookieStore = await cookies();
	cookieStore.delete( "session-id" );
	redirect( "/" );
}