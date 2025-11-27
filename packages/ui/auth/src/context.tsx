import { Spinner } from "@s2h-ui/primitives/spinner";
import type { AuthInfo } from "@s2h/auth/types";
import { useAuthInfoQuery } from "@s2h/client/auth";
import { createContext, type ReactNode, useContext } from "react";

export type IAuthContext = {
	authInfo: AuthInfo | null;
	isLoggedIn: boolean;
}

const AuthContext = createContext<IAuthContext>( { isLoggedIn: false, authInfo: null } );

export function AuthProvider( props: { children: ReactNode } ) {
	const { data, isLoading } = useAuthInfoQuery();

	if ( isLoading || !data ) {
		return <Spinner/>;
	}

	return (
		<AuthContext.Provider value={ { authInfo: data.authInfo, isLoggedIn: !!data.authInfo } }>
			{ props.children }
		</AuthContext.Provider>
	);
}

export const useAuth = () => useContext( AuthContext );