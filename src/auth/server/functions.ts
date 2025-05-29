"use server";

import { loginVerificationInput, registrationVerificationInput, usernameInput } from "@/auth/server/inputs";
import * as service from "@/auth/server/service";
import { createLogger } from "@/shared/utils/logger";
import { os } from "@orpc/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const logger = createLogger( "Auth:Functions" );

export const checkIfUserExists = os.input( usernameInput )
	.handler( async ( { input } ) => service.checkIfUserExists( input.username ) )
	.actionable();

export const getRegistrationOptions = os.input( usernameInput )
	.handler( async ( { input } ) => service.getWebAuthnRegistrationOptions( input.username ) )
	.actionable();

export const getLoginOptions = os.input( usernameInput )
	.handler( async ( { input } ) => service.getWebAuthnLoginOptions( input.username ) )
	.actionable();

export const verifyRegistration = os.input( registrationVerificationInput )
	.handler( async ( { input } ) => {
		const { token, expiresAt } = await service.verifyWebAuthnRegistration( input );
		await setSessionTokenCookie( token, expiresAt );
	} )
	.actionable();

export const verifyLogin = os.input( loginVerificationInput )
	.handler( async ( { input } ) => {
		const { token, expiresAt } = await service.verifyWebAuthnLogin( input );
		await setSessionTokenCookie( token, expiresAt );
	} )
	.actionable();

export async function getAuthInfo() {
	const cookieStore = await cookies();
	const sessionId = cookieStore.get( "session-id" );

	if ( !sessionId?.value ) {
		logger.debug( "No Session Id Cookie!" );
		return undefined;
	}

	const { user } = await service.validateSessionToken( sessionId.value );
	return user;
}

export async function logout() {
	const cookieStore = await cookies();
	cookieStore.set( "session-id", "", {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		maxAge: 0,
		path: "/"
	} );

	redirect( "/" );
}

async function setSessionTokenCookie( token: string, expiresAt: Date ): Promise<void> {
	const cookieStore = await cookies();
	cookieStore.set( "session-id", token, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		expires: expiresAt,
		path: "/"
	} );
}