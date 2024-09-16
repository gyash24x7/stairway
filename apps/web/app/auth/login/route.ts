import { getAuthorizationUrl } from "@auth/api";
import { cookies } from "next/headers";

const cookieOptions = {
	path: "/",
	secure: process.env[ "NODE_ENV" ] === "production",
	httpOnly: true,
	maxAge: 60 * 10,
	sameSite: "lax" as const,
	append: true
};

export async function GET() {
	const { url, state, codeVerifier } = await getAuthorizationUrl();

	cookies().set( "google_oauth_state", state, cookieOptions );
	cookies().set( "google_code_verifier", codeVerifier, cookieOptions );

	return Response.redirect( url, 302 );
}