import ky from "ky";

const BASE_URL = "http://localhost:8000/api";
const GOOGLE_CLIENT_ID = "920568500477-i0243mcdaku24c1sh07tdhr05oprh4vs.apps.googleusercontent.com";
const GOOGLE_REDIRECT_URI = "http://localhost:8000/api/auth/callback";

export type User = {
	id: string;
	name: string;
	email: string;
	avatar: string;
}

export class Paths {
	public static readonly AUTH_USER = "/auth";
	public static readonly LOGOUT = "/auth/logout";
}

export class AuthClient {

	async loadAuthUser() {
		const getAuthUserPath = BASE_URL.concat( Paths.AUTH_USER );
		return ky.get( getAuthUserPath, { credentials: "include" } ).json<User>().catch( () => null );
	}

	async logout() {
		const logoutPath = BASE_URL.concat( Paths.LOGOUT );
		await ky.delete( logoutPath, { credentials: "include" } ).json();
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