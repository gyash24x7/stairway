import { createContext, ReactNode, useContext, useState } from "react";
import { useMeQuery } from "@auth/client";
import type { UserAuthInfo } from "@auth/data";

export interface IAuthContext {
	user?: UserAuthInfo;
	login: VoidFunction;
	logout: VoidFunction;
	isLoggedIn: boolean;
}

const AuthContext = createContext<IAuthContext>( null! );

export function AuthProvider( props: { children: ReactNode } ) {
	const [ isLoggedIn, setIsLoggedIn ] = useState( false );

	const login = () => setIsLoggedIn( true );
	const logout = () => setIsLoggedIn( false );

	const { data } = useMeQuery( { onError: logout, onSuccess: login } );

	return (
		<AuthContext.Provider value={ { user: data, login, logout, isLoggedIn } }>
			{ props.children }
		</AuthContext.Provider>
	);
}

export const useAuth = () => useContext( AuthContext );
