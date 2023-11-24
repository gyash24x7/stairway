import { useCallback, useState } from "react";
import { useAuthStore } from "./store";

// Auth State Hooks
export const useAuthUser = () => useAuthStore( state => state.authUser );
export const useIsLoggedIn = () => useAuthStore( state => state.isLoggedIn );
export const useLogout = () => useAuthStore( state => state.logout );

export const useAction = <R, I = any>( action: ( input: I ) => Promise<R> ) => {
	const [ isLoading, setIsLoading ] = useState( false );
	const [ error, setError ] = useState<string>();
	const [ data, setData ] = useState<R>();

	const execute = useCallback(
		async ( input: I ) => {
			setIsLoading( true );
			return action( input )
				.then( data => {
					setData( data );
					return data;
				} )
				.catch( e => {
					setError( e.message );
					throw e;
				} )
				.finally( () => setIsLoading( false ) );
		},
		[ action ]
	);

	return { isLoading, error, data, execute };
};

// Auth Action Hooks
export const useLogoutAction = () => {
	const logout = useLogout();
	return useAction( logout );
};
