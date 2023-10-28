import type { CreateUserInput, LoginInput, UserAuthInfo } from "@auth/types";
import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { useLoaderData } from "react-router-dom";
import { authClient } from "./client";

export type AuthContextType = {
	authInfo?: UserAuthInfo;
	isLoggedIn: boolean;
	login: ( data: LoginInput ) => Promise<void>;
	logout: () => Promise<void>;
	signUp: ( data: CreateUserInput ) => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>( {
	isLoggedIn: false,
	login: () => Promise.resolve(),
	logout: () => Promise.resolve(),
	signUp: () => Promise.resolve()
} );

export function AuthProvider( props: { children: ReactNode } ) {
	const authInfoFromLoader = useLoaderData() as UserAuthInfo | undefined;
	const [ authInfo, setAuthInfo ] = useState( authInfoFromLoader );

	const login = useCallback( async ( data: LoginInput ) => {
		const authInfo = await authClient.login( data );
		setAuthInfo( authInfo );
	}, [] );

	const logout = useCallback( async () => {
		await authClient.logout();
		setAuthInfo( undefined );
	}, [] );

	const signUp = useCallback( async ( data: CreateUserInput ) => {
		await authClient.signUp( data );
	}, [] );

	return (
		<AuthContext.Provider value={ { authInfo, isLoggedIn: !!authInfo, login, logout, signUp } }>
			{ props.children }
		</AuthContext.Provider>
	);
}

export const useAuth = () => useContext( AuthContext );
