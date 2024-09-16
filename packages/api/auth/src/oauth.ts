import { generateCodeVerifier, generateState, Google, OAuth2RequestError } from "arctic";
import { eq } from "drizzle-orm";
import * as crypto from "node:crypto";
import { db, lucia } from "./lucia.ts";
import * as schema from "./schema.ts";

const AVATAR_BASE_URL = "https://api.dicebear.com/7.x/open-peeps/png?seed=";

const clientId = process.env[ "GOOGLE_CLIENT_ID" ]!;
const clientSecret = process.env[ "GOOGLE_CLIENT_SECRET" ]!;
const redirectUri = process.env[ "GOOGLE_REDIRECT_URI" ]!;

const google = new Google( clientId, clientSecret, redirectUri );

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

export async function getAuthorizationUrl() {
	const state = generateState();
	const codeVerifier = generateCodeVerifier();
	const scopes = [ "openid", "profile", "email" ];
	const url = await google.createAuthorizationURL( state, codeVerifier, { scopes } );
	return { url, state, codeVerifier };
}

async function getGoogleUser( code: string, codeVerifier: string ) {
	const tokens = await google.validateAuthorizationCode( code, codeVerifier );

	const url = new URL( "https://www.googleapis.com/oauth2/v1/userinfo" );
	url.searchParams.append( "alt", "json" );
	url.searchParams.append( "access_token", tokens.accessToken );

	const headers = { Authorization: `Bearer ${ tokens.idToken }` };
	const user = await fetch( url, { headers } ).then( res => res.json() );
	return user as GoogleUser;
}

export async function handleAuthCallback( code: string, codeVerifier: string ) {
	try {
		const { name, email } = await getGoogleUser( code, codeVerifier );
		let user = await db.query.users.findFirst( { where: eq( schema.users.email, email ) } );

		if ( !user ) {
			const hash = crypto.randomBytes( 48 ).toString( "hex" );
			const avatar = `${ AVATAR_BASE_URL }/${ hash }.png?r=50`;
			[ user ] = await db.insert( schema.users ).values( { name, email, avatar } ).returning();
		}

		const session = await lucia.createSession( user.id, {} );
		const sessionCookie = lucia.createSessionCookie( session.id );
		return { status: 302 as const, sessionCookie };
	} catch ( e ) {
		return { status: e instanceof OAuth2RequestError ? 400 as const : 500 as const };
	}
}

export async function validateSessionAndGetUser( sessionId: string ) {
	const { user, session } = await lucia.validateSession( sessionId );

	if ( session && session.fresh ) {
		const cookie = lucia.createSessionCookie( session.id );
		return { user, cookie, session };
	}
	if ( !session ) {
		return { cookie: lucia.createBlankSessionCookie() };
	}

	return { user, session };
}