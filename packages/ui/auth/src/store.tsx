import type { Router as AuthRouter } from "@backend/auth";
import { Spinner } from "@gluestack-ui/themed";
import { storage, trpcLink } from "@shared/ui";
import { useQueryClient } from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import { Fragment, type PropsWithChildren, useEffect } from "react";
import { create } from "zustand";

export type UserAuthInfo = {
	id: string;
	name: string;
	avatar: string;
	verified: boolean;
}

export type AuthStore = {
	isLoggedIn: boolean;
	authInfo?: UserAuthInfo;
	handleLogin: ( data: { authToken: string, authInfo?: UserAuthInfo } ) => Promise<void>;
	handleLogout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>( set => ( {
	isLoggedIn: false,
	handleLogin: async ( { authToken, authInfo } ) => {
		await storage.setItem( "authToken", authToken ?? "" );
		set( () => ( { isLoggedIn: true, authInfo } ) );
	},
	handleLogout: async () => {
		await storage.clear();
		set( () => ( { isLoggedIn: false, authInfo: undefined } ) );
	}
} ) );

export function initializeAuthStore( data?: UserAuthInfo ) {
	useAuthStore.setState( ( initialState ) => ( { ...initialState, authInfo: data, isLoggedIn: !!data } ) );
}

export const useIsLoggedIn = () => useAuthStore( state => state.isLoggedIn );
export const useAuthInfo = () => useAuthStore( state => state.authInfo );
export const useLoginHandler = () => useAuthStore( state => state.handleLogin );
export const useLogoutHandler = () => useAuthStore( state => state.handleLogout );

export const AuthTrpc = createTRPCReact<AuthRouter>();
export const authTrpcClient = AuthTrpc.createClient( { links: [ trpcLink( "auth" ) ] } );

export const useLoginMutation = () => AuthTrpc.login.useMutation();
export const useSignUpMutation = () => AuthTrpc.createUser.useMutation();
export const useAuthInfoQuery = () => AuthTrpc.authInfo.useQuery();

export const AuthProvider = ( props: PropsWithChildren ) => {
	const queryClient = useQueryClient();
	return (
		<AuthTrpc.Provider queryClient={ queryClient } client={ authTrpcClient }>
			<AuthContextProvider>
				{ props.children }
			</AuthContextProvider>
		</AuthTrpc.Provider>
	);
};

const AuthContextProvider = ( props: PropsWithChildren ) => {
	const { data, isLoading } = useAuthInfoQuery();

	useEffect( () => {
		initializeAuthStore( data );
	}, [ data ] );

	if ( isLoading ) {
		return <Spinner size={ "large" }/>;
	}

	return <Fragment>{ props.children }</Fragment>;
};