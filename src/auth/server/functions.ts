"use server";

import { loginVerificationInput, registrationVerificationInput, usernameInput } from "@/auth/server/inputs";
import * as service from "@/auth/server/service";
import { createLogger } from "@/shared/utils/logger";
import { os } from "@orpc/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const logger = createLogger( "Auth:Functions" );

export const getRegistrationOptions = os.input( usernameInput )
	.handler( async ( { input } ) => service.getWebAuthnRegistrationOptions( input.username ) )
	.actionable();

export const getLoginOptions = os.input( usernameInput )
	.handler( async ( { input } ) => service.getWebAuthnLoginOptions( input.username ) )
	.actionable();

export const verifyRegistration = os.input( registrationVerificationInput )
	.handler( async ( { input } ) => service.verifyWebAuthnRegistration( input ) )
	.actionable();

export const verifyLogin = os.input( loginVerificationInput )
	.handler( async ( { input } ) => service.verifyWebAuthnLogin( input ) )
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