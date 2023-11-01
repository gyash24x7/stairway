import type { CreateUserInput, LoginInput, UserAuthInfo } from "@auth/types";
import { getRequest, postRequest } from "@s2h/client";

export class AuthClient {

	async loadAuthInfo() {
		return getRequest<UserAuthInfo>( "/auth" ).catch( () => null );
	}

	async getToken() {
		return getRequest<{ token: string }>( "/auth/token" );
	}

	async login( data: LoginInput ) {
		return postRequest<UserAuthInfo>( "/auth/login", data );
	}

	async logout() {
		return postRequest<void>( "/auth/logout", {} );
	}

	async signUp( data: CreateUserInput ) {
		return postRequest<void>( "/auth/signup", data );
	}
}

export const authClient = new AuthClient();