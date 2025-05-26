"use server";

import { createLogger } from "@/shared/utils/logger";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const rpId = "localhost";
const origin = `http://${ rpId }:3000`;
const logger = createLogger( "Auth:Functions" );

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