import { createLogger, prisma } from "@stairway/api/utils";
import { generateCodeVerifier, generateState, OAuth2RequestError } from "arctic";
import { google, lucia } from "./lucia.ts";

type GoogleUser = {
	id: string;
	email: string;
	verified_email: boolean;
	name: string;
	given_name: string;
	family_name: string;
	picture: string;
	locale: string;
}

const logger = createLogger( "AuthService" );

export async function getAuthorizationUrl() {
	logger.debug( ">> getAuthorizationUrl()" );

	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const scopes = [ "openid", "profile", "email" ];
	const url = await google.createAuthorizationURL( state, codeVerifier, { scopes } );

	logger.debug( "<< getAuthorizationUrl()" );
	return { url, state, codeVerifier };
}

export async function handleAuthCallback( code: string, codeVerifier: string ) {
	logger.debug( ">> handleAuthCallback()" );

	try {
		const { name, email } = await getGoogleUser( code, codeVerifier );
		let user = await prisma.auth.user.findUnique( { where: { email } } );

		if ( !user ) {
			const seed = Math.floor( Math.random() * 200 );
			const avatar = `https://api.dicebear.com/7.x/open-peeps/png?seed=${ seed }&r=50`;
			user = await prisma.auth.user.create( { data: { name, email, avatar } } );
		}

		const session = await lucia.createSession( user.id, {} );
		const sessionCookie = lucia.createSessionCookie( session.id );

		logger.debug( "<< handleAuthCallback()" );
		return { status: 302 as const, sessionCookie };

	} catch ( e: any ) {
		logger.error( "Error getting google user!", e.message );
		logger.debug( "<< handleAuthCallback()" );
		return { status: e instanceof OAuth2RequestError ? 400 as const : 500 as const };
	}
}

async function getGoogleUser( code: string, codeVerifier: string ) {
	logger.debug( ">> getGoogleUser()" );

	const tokens = await google.validateAuthorizationCode( code, codeVerifier );

	const url = new URL( "https://www.googleapis.com/oauth2/v1/userinfo" );
	url.searchParams.append( "alt", "json" );
	url.searchParams.append( "access_token", tokens.accessToken );

	const headers = { Authorization: `Bearer ${ tokens.idToken }` };
	const user = await fetch( url, { headers } ).then( res => res.json() );

	logger.debug( "<< getGoogleUser()" );
	return user as GoogleUser;
}