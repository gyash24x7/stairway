"use server";

import type { Session, User, UserDevice } from "@/auth/types";
import { generateAvatar, generateId } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import {
	type AuthenticationResponseJSON,
	generateAuthenticationOptions,
	type GenerateAuthenticationOptionsOpts,
	generateRegistrationOptions,
	type GenerateRegistrationOptionsOpts,
	type RegistrationResponseJSON,
	verifyAuthenticationResponse,
	type VerifyAuthenticationResponseOpts,
	verifyRegistrationResponse,
	type VerifyRegistrationResponseOpts
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const rpId = "localhost";
const origin = `http://${ rpId }:3000`;
const logger = createLogger( "Auth:Functions" );

export async function getAuthInfo() {
	const cookieStore = await cookies();
	const sessionId = cookieStore.get( "session-id" );

	if ( !sessionId?.value ) {
		logger.debug( "No Session Id Cookie!" );
		return undefined;
	}

	const session = await getSession( sessionId.value );
	if ( !session ) {
		logger.debug( "No Session for session id!" );
		return undefined;
	}

	if ( !session.username ) {
		logger.debug( "No Username present in session!" );
		return undefined;
	}

	const user = await getUserByUsername( session.username );
	if ( !user ) {
		logger.debug( "User not found!" );
		return undefined;
	}

	return user;
}

export async function logout() {
	const cookieStore = await cookies();
	cookieStore.delete( "session-id" );
	redirect( "/" );
}

export async function generateWebAuthnRegistrationOptions( username: string ) {
	const encoder = new TextEncoder();
	const user = await getUserByUsername( username );

	if ( user ) {
		return { success: false, message: "User already exists" };
	}

	const opts: GenerateRegistrationOptionsOpts = {
		rpName: "SimpleWebAuthn Example",
		rpID: rpId,
		userID: encoder.encode( username ),
		userName: username,
		timeout: 60000,
		attestationType: "none",
		excludeCredentials: [],
		authenticatorSelection: {
			residentKey: "discouraged"
		},
		supportedAlgorithmIDs: [ -7, -257 ]
	};

	const options = await generateRegistrationOptions( opts );

	await updateCurrentSession( { currentChallenge: options.challenge, username } );

	return { success: true, data: options };
}

export async function verifyWebAuthnRegistration( data: RegistrationResponseJSON ) {
	const { data: { username, currentChallenge } } = await getCurrentSession();

	if ( !username || !currentChallenge ) {
		return {
			success: false,
			message: "Session expired"
		};
	}

	const opts: VerifyRegistrationResponseOpts = {
		response: data,
		expectedChallenge: `${ currentChallenge }`,
		expectedOrigin: origin,
		expectedRPID: rpId,
		requireUserVerification: false
	};
	const verification = await verifyRegistrationResponse( opts );

	const { verified, registrationInfo } = verification;

	if ( !verified || !registrationInfo ) {
		return {
			success: false,
			message: "Registration failed"
		};
	}

	/**
	 * Add the returned device to the user's list of devices
	 */
	const newDevice: UserDevice = {
		credentialPublicKey: isoBase64URL.fromBuffer( registrationInfo.credential.publicKey ),
		credentialID: registrationInfo.credential.id,
		counter: registrationInfo.credential.counter,
		transports: data.response.transports
	};

	await updateCurrentSession( {} );

	try {
		await createUser( { username, name: "", devices: [ newDevice ] } );
	} catch {
		return {
			success: false,
			message: "User already exists"
		};
	}

	return {
		success: true
	};
}

export async function generateWebAuthnLoginOptions( username: string ) {
	const user = await getUserByUsername( username );

	if ( !user ) {
		return {
			success: false,
			message: "User does not exist"
		};
	}

	const opts: GenerateAuthenticationOptionsOpts = {
		timeout: 60000,
		allowCredentials: user.devices.map( ( dev ) => ( {
			id: dev.credentialID,
			type: "public-key",
			transports: dev.transports
		} ) ),
		userVerification: "required",
		rpID: rpId
	};
	const options = await generateAuthenticationOptions( opts );

	await updateCurrentSession( { currentChallenge: options.challenge, username } );

	return {
		success: true,
		data: options
	};
}

export async function verifyWebAuthnLogin( data: AuthenticationResponseJSON ) {
	const { data: { username, currentChallenge } } = await getCurrentSession();

	if ( !username || !currentChallenge ) {
		return {
			success: false,
			message: "Session expired"
		};
	}

	const user = await getUserByUsername( username );

	if ( !user ) {
		return {
			success: false,
			message: "User does not exist"
		};
	}

	const dbAuthenticator = user.devices.find( ( dev ) => dev.credentialID === data.rawId );

	if ( !dbAuthenticator ) {
		return {
			success: false,
			message: "Authenticator is not registered with this site"
		};
	}

	const opts: VerifyAuthenticationResponseOpts = {
		response: data,
		expectedChallenge: `${ currentChallenge }`,
		expectedOrigin: origin,
		expectedRPID: rpId,
		requireUserVerification: true,
		credential: {
			id: dbAuthenticator.credentialID,
			publicKey: isoBase64URL.toBuffer( dbAuthenticator.credentialPublicKey ),
			counter: dbAuthenticator.counter,
			transports: dbAuthenticator.transports
		}
	};
	const verification = await verifyAuthenticationResponse( opts );

	await updateCurrentSession( {} );

	return {
		success: verification.verified
	};
}

const kv = new Map<string, Session>();

export async function getSession( id: string ) {
	return kv.get( id );
}

export async function createSession( id: string, data: Session ) {
	return kv.set( id, data );
}

export async function getCurrentSession() {
	const cookieStore = await cookies();
	const sessionId = cookieStore.get( "session-id" );

	if ( sessionId?.value ) {
		const session = await getSession( sessionId.value );

		if ( session ) {
			return { sessionId: sessionId.value, data: session };
		}
	}

	const newSessionId = Math.random().toString( 36 ).slice( 2 );
	cookieStore.set( "session-id", newSessionId );

	await createSession( newSessionId, { currentChallenge: undefined } );

	return { sessionId: newSessionId, data: { currentChallenge: undefined } };
}

export async function updateCurrentSession( data: Session ) {
	const { sessionId, data: oldData } = await getCurrentSession();
	await createSession( sessionId, { ...oldData, ...data } );
}

const userMap = new Map<string, User>;

export async function getUserByUsername( username: string ): Promise<User | undefined> {
	return userMap.get( username );
}

export async function createUser( data: { name: string, username: string, devices: UserDevice[] } ): Promise<User> {
	const user = {
		id: generateId(),
		name: data.name,
		avatar: generateAvatar(),
		username: data.username,
		devices: data.devices
	};

	userMap.set( data.username, user );
	return user;
}

export async function checkIfUserExists( username: string ): Promise<boolean> {
	const user = await getUserByUsername( username );
	return !!user;
}