import type { CreateUserInput, LoginInput, UserAuthInfo } from "@auth/types";
import type { ApiResponse } from "@s2h/client";
import { getRequest, postRequest } from "@s2h/client";
import { create } from "zustand";

export type AuthStore = {
	authInfo?: UserAuthInfo;
	isLoggedIn: boolean;
	login: ( data: LoginInput ) => Promise<void>;
	logout: () => Promise<void>;
	signUp: ( data: CreateUserInput ) => Promise<ApiResponse>;
}

export const useAuthStore = create<AuthStore>( set => {
	return {
		isLoggedIn: false,
		async login( data: LoginInput ) {
			const authInfo = await postRequest<UserAuthInfo>( "/auth/login", data );
			set( state => {
				return { ...state, authInfo, isLoggedIn: true };
			} );
		},
		async logout() {
			await postRequest<void>( "/auth/logout", {} );
			set( state => {
				return { ...state, authInfo: undefined, isLoggedIn: false };
			} );
		},
		signUp( data: CreateUserInput ): Promise<ApiResponse> {
			return postRequest( "/auth/signup", data );
		}
	};
} );

export async function initializeAuthStore() {
	const authInfo = await getRequest<UserAuthInfo>( "/auth" ).catch( () => undefined );
	useAuthStore.setState( state => {
		return { ...state, authInfo, isLoggedIn: !!authInfo };
	} );
}
