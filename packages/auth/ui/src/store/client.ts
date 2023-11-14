import type { UserAuthInfo } from "@auth/data";
import superagent from "superagent";

const BASE_URL = "http://localhost:8000/api";
const GOOGLE_CLIENT_ID = "920568500477-i0243mcdaku24c1sh07tdhr05oprh4vs.apps.googleusercontent.com";
const GOOGLE_REDIRECT_URI = "http://localhost:8000/api/auth/callback";

export class Paths {
	public static readonly AUTH_INFO = "/auth";
	public static readonly LOGOUT = "/auth/logout";
}

export class AuthClient {

	async loadAuthInfo() {
		return superagent
			.get( BASE_URL + Paths.AUTH_INFO )
			.withCredentials()
			.then( res => res.body as UserAuthInfo )
			.catch( () => null );
	}

	async logout() {
		await superagent.delete( BASE_URL + Paths.LOGOUT ).withCredentials();
	}

	getGoogleAuthUrl() {
		const url = new URL( "https://accounts.google.com/o/oauth2/v2/auth" );

		url.searchParams.append( "redirect_uri", GOOGLE_REDIRECT_URI );
		url.searchParams.append( "client_id", GOOGLE_CLIENT_ID );
		url.searchParams.append( "access_type", "offline" );
		url.searchParams.append( "response_type", "code" );
		url.searchParams.append( "prompt", "consent" );
		url.searchParams.append(
			"scope",
			[
				"https://www.googleapis.com/auth/userinfo.profile",
				"https://www.googleapis.com/auth/userinfo.email"
			].join( " " )
		);

		return url.toString();
	}
}

export const authClient = new AuthClient();