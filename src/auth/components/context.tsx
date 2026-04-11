import { getAuthInfo } from "@/auth/core/actions";
import type { AuthInfo } from "@/auth/core/types";
import { Spinner } from "@/shared/primitives/spinner";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createContext, type ReactNode, useContext } from "react";

type AuthContextType = {
	authInfo: AuthInfo | null;
}

const AuthContext = createContext<AuthContextType | undefined>( undefined );

export function AuthProvider( { children }: { children: ReactNode } ) {
	const authInfo = useServerFn( getAuthInfo );
	const { data, isPending } = useQuery( {
		queryFn: authInfo,
		queryKey: [ "authInfo" ]
	} );

	if ( isPending ) {
		return (
			<div className={ "flex w-screen h-screen items-center justify-center" }>
				<Spinner size={ "xl" }/>
			</div>
		);
	}

	return (
		<AuthContext.Provider value={ { authInfo: data ?? null } }>
			{ children }
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext( AuthContext );
	if ( !context ) {
		throw new Error( "useAuth must be used within AuthProvider" );
	}
	return context;
}