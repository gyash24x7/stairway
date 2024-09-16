"use server";

import { lucia, validateSessionAndGetUser } from "@auth/api";
import { sign } from "jsonwebtoken";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as process from "node:process";
import { cache } from "react";
import { createServerAction } from "zsa";

export const getAuthInfo = cache( async () => {
	const sessionId = cookies().get( lucia.sessionCookieName )?.value;
	if ( !sessionId ) {
		return;
	}

	const result = await validateSessionAndGetUser( sessionId );
	return result.user;
} );

export const getAuthToken = cache( async () => {
	const sessionId = cookies().get( lucia.sessionCookieName )?.value;
	if ( !sessionId ) {
		return;
	}

	const result = await validateSessionAndGetUser( sessionId );
	if ( result.user ) {
		return sign( result.user!, process.env[ "JWT_SECRET" ]! );
	}

	return;
} );

export const logout = createServerAction().handler( async () => {
	const sessionId = cookies().get( lucia.sessionCookieName )?.value;
	if ( !sessionId ) {
		return;
	}

	const result = await validateSessionAndGetUser( sessionId );
	if ( !result.user ) {
		return;
	}

	await lucia.invalidateSession( sessionId! );

	const cookie = result.cookie ?? lucia.createBlankSessionCookie();
	cookies().set( cookie.name, cookie.value, cookie.attributes );

	redirect( "/" );
} );