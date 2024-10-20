"use server";
import "server-only";

import { createLogger } from "@stairway/api/utils";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { lucia } from "./lucia.ts";

const logger = createLogger( "AuthFunctions" );

export async function getAuthInfo() {
	logger.debug( ">> user()" );
	const { user } = await validateRequest();
	logger.debug( "<< user()" );
	return user;
}

export async function logout() {
	logger.debug( ">> invalidateSession()" );

	const { session } = await validateRequest();
	if ( !session ) {
		return { error: "Unauthorized" };
	}

	await lucia.invalidateSession( session.id );
	const sessionCookie = lucia.createBlankSessionCookie();
	cookies().set( sessionCookie.name, sessionCookie.value, sessionCookie.attributes );

	logger.debug( "<< invalidateSession()" );
	return redirect( "/" );
}


const validateRequest = cache( async () => {
	logger.debug( ">> validateRequest()" );

	const sessionId = cookies().get( lucia.sessionCookieName )?.value;
	if ( !sessionId ) {
		logger.warn( "Unauthorized!" );
		logger.debug( "<< validateRequest()" );
		return { user: null, session: null };
	}

	const result = await lucia.validateSession( sessionId );

	try {
		if ( result.session && result.session.fresh ) {
			const sessionCookie = lucia.createSessionCookie( result.session.id );
			cookies().set( sessionCookie.name, sessionCookie.value, sessionCookie.attributes );
		}
		if ( !result.session ) {
			const sessionCookie = lucia.createBlankSessionCookie();
			cookies().set( sessionCookie.name, sessionCookie.value, sessionCookie.attributes );
		}
	} catch {}

	logger.debug( "<< validateRequest()" );
	return result;
} );

