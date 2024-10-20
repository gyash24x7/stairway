import { getAuthorizationUrl } from "@stairway/api/auth";
import { createLogger } from "@stairway/api/utils";
import { cookies } from "next/headers";

const cookieOptions = {
	domain: "localhost",
	path: "/",
	secure: process.env[ "NODE_ENV" ] === "production",
	httpOnly: true,
	maxAge: 60, // 1 min
	sameSite: "lax" as const,
	append: true
};

const logger = createLogger( "LoginRoute" );

export async function GET(): Promise<Response> {
	logger.debug( ">> login()" );

	const { url, state, codeVerifier } = await getAuthorizationUrl();
	cookies().set( "google_oauth_state", state, cookieOptions );
	cookies().set( "google_code_verifier", codeVerifier, cookieOptions );

	logger.debug( "<< login()" );
	return Response.redirect( url );
}