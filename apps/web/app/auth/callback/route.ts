import { handleAuthCallback } from "@stairway/api/auth";
import { createLogger } from "@stairway/api/utils";
import { cookies } from "next/headers";

const FRONTEND_URL = process.env[ "FRONTEND_URL" ] ?? "http://localhost:3000";

const logger = createLogger( "AuthCallbackRoute" );

export async function GET( request: Request ) {
	logger.debug( ">> authCallback()" );

	const url = new URL( request.url );
	const code = url.searchParams.get( "code" );
	const state = url.searchParams.get( "state" );
	const storedState = cookies().get( "google_oauth_state" )?.value;
	const codeVerifier = cookies().get( "google_code_verifier" )?.value;

	if ( !code || !state || !storedState || !codeVerifier || state !== storedState ) {
		logger.error( "StoredState: %s", storedState );
		logger.error( "CodeVerifier: %s", codeVerifier );
		logger.debug( "<< authCallback()" );
		throw new Response( null, { status: 400 } );
	}

	const { status, sessionCookie } = await handleAuthCallback( code, codeVerifier );
	if ( sessionCookie ) {
		cookies().set( sessionCookie.name, sessionCookie.value, sessionCookie.attributes );
	}

	logger.debug( "<< authCallback()" );
	return Response.redirect( FRONTEND_URL, status );
}