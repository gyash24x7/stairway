import type {
	NameInput,
	UsernameInput,
	VerifyLoginInput,
	VerifyRegistrationInput,
	WebauthnOptions
} from "@/auth/types";
import { generateAvatar, generateId } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { prisma } from "@/shared/utils/prisma";
import {
	generateAuthenticationOptions,
	generateRegistrationOptions,
	verifyAuthenticationResponse,
	verifyRegistrationResponse
} from "@simplewebauthn/server";
import { env } from "cloudflare:workers";

const logger = createLogger( "Auth:Service" );

async function userExists( username: string ) {
	logger.debug( ">> userExists()" );
	const user = await prisma.user.findUnique( { where: { username } } );
	logger.debug( "<< userExists()" );
	return !!user;
}

async function getRegistrationOptions( { name, username }: UsernameInput & NameInput ) {
	logger.debug( ">> getRegistrationOptions()" );

	const options = await generateRegistrationOptions( {
		userDisplayName: name,
		rpID: env.WEBAUTHN_RP_ID,
		rpName: env.APP_NAME,
		userName: username,
		attestationType: "none",
		authenticatorSelection: {
			residentKey: "preferred",
			userVerification: "preferred"
		}
	} );

	const webAuthnOptions = { challenge: options.challenge, webauthnUserId: options.user.id };
	await env.WEBAUTHN_KV.put( username, JSON.stringify( webAuthnOptions ) );
	logger.info( "Stored WebAuthn options in KV for user:", username );

	logger.debug( "<< getRegistrationOptions()" );
	return options;
}

async function getLoginOptions( { username }: UsernameInput ) {
	logger.debug( ">> getLoginOptions()" );

	const user = await prisma.user.findUnique( { where: { username } } );
	if ( !user ) {
		logger.error( "User not found for username:", username );
		throw "User not found";
	}

	const options = await generateAuthenticationOptions( {
		rpID: env.WEBAUTHN_RP_ID,
		userVerification: "preferred",
		allowCredentials: []
	} );

	const webAuthnOptions = { challenge: options.challenge };
	await env.WEBAUTHN_KV.put( username, JSON.stringify( webAuthnOptions ) );
	logger.info( "Stored WebAuthn options in KV for user:", username );

	logger.debug( "<< getLoginOptions()" );
	return options;
}

async function verifyRegistration( { username, name, response }: VerifyRegistrationInput ) {
	logger.debug( ">> verifyRegistration()" );

	const options = await getWebAuthnOptions( username );
	const verification = await verifyRegistrationResponse( {
		response: response,
		expectedChallenge: options.challenge,
		expectedOrigin: env.APP_URL,
		expectedRPID: env.WEBAUTHN_RP_ID
	} );

	if ( !verification || !verification.verified || !verification.registrationInfo ) {
		logger.error( "WebAuthn verification failed for user:", username );
		throw "WebAuthn verification failed";
	}

	const user = await prisma.user.create( {
		data: { name, username, id: generateId(), avatar: generateAvatar() }
	} );

	logger.info( "User created for WebAuthn registration:", user.id );

	await prisma.passkey.create( {
		data: {
			id: verification.registrationInfo.credential.id,
			publicKey: verification.registrationInfo.credential.publicKey,
			userId: user.id,
			counter: verification.registrationInfo.credential.counter
		}
	} );

	logger.info( "Passkey created for user:", user.id );

	await env.WEBAUTHN_KV.delete( username );
	logger.info( "Deleted WebAuthn options from KV for user:", username );

	logger.debug( "<< verifyRegistration()" );
	return user;
}

async function verifyLogin( { username, response }: VerifyLoginInput ) {
	logger.debug( ">> verifyLogin()" );

	const options = await getWebAuthnOptions( username );
	const user = await prisma.user.findUnique( { where: { username } } );

	if ( !user ) {
		logger.error( "User not found for username:", username );
		throw "User not found";
	}

	const passkey = await prisma.passkey.findFirst( {
		where: { id: response.id, userId: user.id }
	} );

	if ( !passkey ) {
		logger.error( "Passkey not found for user:", user.id, "with ID:", response.id );
		throw "Passkey not found for user";
	}

	logger.info( "Passkey exists for user:", user.id );

	const verification = await verifyAuthenticationResponse( {
		response,
		expectedChallenge: options.challenge,
		expectedOrigin: env.APP_URL,
		expectedRPID: env.WEBAUTHN_RP_ID,
		credential: {
			id: passkey.id,
			publicKey: passkey.publicKey as Uint8Array<ArrayBuffer>,
			counter: passkey.counter
		}
	} );

	if ( !verification || !verification.verified || !verification.authenticationInfo ) {
		logger.error( "WebAuthn authentication verification failed for user:", user.username );
		throw "WebAuthn authentication verification failed";
	}

	logger.info( "WebAuthn authentication verified for user:", user.username );

	await prisma.passkey.update( {
		where: { id: passkey.id, userId: user.id },
		data: { counter: verification.authenticationInfo.newCounter }
	} );

	logger.info( "Passkey counter updated for user:", user.id );

	await env.WEBAUTHN_KV.delete( username );
	logger.info( "Deleted WebAuthn options from KV for user:", username );

	logger.debug( "<< verifyLogin()" );
	return user;
}

async function getWebAuthnOptions( username: string ) {
	logger.debug( ">> getWebAuthnOptions()" );

	const optionsJSON = await env.WEBAUTHN_KV.get( username );
	if ( !optionsJSON ) {
		logger.error( "No WebAuthn options found for username:", username );
		throw "No WebAuthn options found for user";
	}

	const options = JSON.parse( optionsJSON ) as WebauthnOptions;
	logger.info( "Validated WebAuthn options for user:", username );

	logger.debug( "<< getWebAuthnOptions()" );
	return options;
}

export const service = {
	userExists,
	getRegistrationOptions,
	verifyRegistration,
	getLoginOptions,
	verifyLogin
};