import type { CreateUserInput, LoginInput, UserAuthInfo } from "@auth/data";

const BASE_URL = "http://localhost:8000/api";

export class Paths {
	public static readonly AUTH_INFO = "/auth";
	public static readonly GET_TOKEN = "/auth/token";
	public static readonly LOGIN = "/auth/login";
	public static readonly LOGOUT = "/auth/logout";
	public static readonly SIGNUP = "/auth/signup";
}

const query = <T = any>( path: string ) => fetch( BASE_URL + path, { credentials: "include" } )
	.then<T>( res => res.json() );

const mutation = <T = any>( path: string, data?: any ) => fetch( BASE_URL + path, {
	method: "POST",
	credentials: "include",
	body: !!data ? JSON.stringify( data ) : undefined
} ).then<T>( res => res.json() );

export class AuthClient {

	async loadAuthInfo() {
		return query<UserAuthInfo>( Paths.AUTH_INFO ).catch( () => null );
	}

	async getToken() {
		return query<{ token: string }>( Paths.GET_TOKEN );
	}

	async login( data: LoginInput ) {
		return mutation<UserAuthInfo>( Paths.LOGIN, data );
	}

	async logout() {
		await mutation( Paths.LOGOUT );
	}

	async signUp( data: CreateUserInput ) {
		await mutation( Paths.SIGNUP, data );
	}
}

export const authClient = new AuthClient();