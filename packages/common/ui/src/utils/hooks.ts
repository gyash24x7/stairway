import { useCallback, useState } from "react";

export const useAction = <R, I = undefined>( action: ( input: I ) => Promise<R> ) => {
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