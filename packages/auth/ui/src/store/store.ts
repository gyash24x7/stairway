import type { CreateUserInput, LoginInput, UserAuthInfo } from "@auth/data";
import { produce } from "immer";
import { create } from "zustand";
import { authClient } from "./client";

export type AuthState = {
	isLoggedIn: boolean;
	authInfo?: UserAuthInfo | null;
	authToken?: string | null;
};

export type AuthActions = {
	loadAuthInfo: ( authInfo: UserAuthInfo ) => void;
	getToken: () => Promise<void>;
	login: ( input: LoginInput ) => Promise<void>;
	logout: () => Promise<void>;
	signUp: ( input: CreateUserInput ) => Promise<void>;
}

export const useAuthStore = create<AuthActions & AuthState>()( ( set ) => {
	return {
		isLoggedIn: false,
		authInfo: undefined,
		loadAuthInfo: authInfo => {
			set( produce( state => {
				state.isLoggedIn = true;
				state.authInfo = authInfo;
			} ) );
		},
		getToken: async () => {
			const { token } = await authClient.getToken();
			set( produce( state => {
				state.authToken = token;
			} ) );
		},
		login: async ( input ) => {
			const authInfo = await authClient.login( input );
			set( produce( state => {
				state.isLoggedIn = true;
				state.authInfo = authInfo;
			} ) );
		},
		logout: async () => {
			await authClient.logout();
			set( produce( state => {
				state.isLoggedIn = false;
				state.authInfo = undefined;
			} ) );
		},
		signUp: async ( input ) => {
			await authClient.signUp( input );
		}
	};
} );
