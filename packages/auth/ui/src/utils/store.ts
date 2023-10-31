import { create } from "zustand";
import type { CreateUserInput, LoginInput, UserAuthInfo } from "@auth/types";
import { produce } from "immer";
import { authClient } from "./client";
import { useAction } from "@s2h/ui";

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
};

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

export async function authStoreLoader() {
	const initialState: AuthState = {
		isLoggedIn: false,
		authInfo: null,
		authToken: null
	};

	const authInfo = await authClient.loadAuthInfo();
	initialState.authInfo = authInfo;
	initialState.isLoggedIn = !!authInfo;

	if ( !!authInfo ) {
		const { token } = await authClient.getToken();
		initialState.authToken = token;
	}

	useAuthStore.setState( initialState );
	return initialState;
}

export const useAuthInfo = () => useAuthStore( state => state.authInfo );

export const useIsLoggedIn = () => useAuthStore( state => state.isLoggedIn );

export const useAuthToken = () => useAuthStore( state => state.authToken );

export const useLoadAuthInfoAction = () => useAuthStore( state => state.loadAuthInfo );

export const useGetTokenAction = () => useAuthStore( state => state.getToken );

export const useLoginAction = () => {
	const login = useAuthStore( state => state.login );
	return useAction( login );
};

export const useLogoutAction = () => {
	const logout = useAuthStore( state => state.logout );
	return useAction( logout );
};

export const useSignUpAction = () => {
	const signUp = useAuthStore( state => state.signUp );
	return useAction( signUp );
};
