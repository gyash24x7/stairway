import { handleAuthCallback } from "@auth/api";
import { cookies } from "next/headers";

export async function GET( request: Request ) {
	const url = new URL( request.url! );
	const code = url.searchParams.get( "code" );
	const state = url.searchParams.get( "state" );

	const storedState = cookies().get( "google_oauth_state" )?.value ?? null;
	const codeVerifier = cookies().get( "google_code_verifier" )?.value ?? null;

	if ( !code || !state || !storedState || !codeVerifier || state !== storedState ) {
		return new Response( null, { status: 400 } );
	}

	const { status, sessionCookie } = await handleAuthCallback( code, codeVerifier );
	if ( sessionCookie ) {
		cookies().set( sessionCookie.name, sessionCookie.value, sessionCookie.attributes );
	}

	return Response.redirect( "http://localhost:3000", status );
}