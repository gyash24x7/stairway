import { createContext, ReactNode, useContext } from "react";
import type { UserAuthInfo } from "@auth/data";
import { useMeQuery } from "@auth/client";
import { Loader } from "@mantine/core";

export interface IAuthContext {
	user: UserAuthInfo | null | undefined;
	isLoggedIn: boolean;
	refetchAuthInfo: VoidFunction;
}

const AuthContext = createContext<IAuthContext>( null! );

export function AuthProvider( props: { children: ReactNode } ) {
	const { data: user, isLoading, refetch } = useMeQuery();

	const refetchAuthInfo = () => refetch();

	if ( isLoading ) {
		return <Loader/>;
	}

	return (
		<AuthContext.Provider value={ { user, isLoggedIn: !!user, refetchAuthInfo } }>
			{ props.children }
		</AuthContext.Provider>
	);
}

export const useAuth = () => useContext( AuthContext );
