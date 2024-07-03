import type { Game } from "@backend/wordle";
import { Box, KeyboardAvoidingView, RefreshControl, ScrollView, Spinner } from "@gluestack-ui/themed";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { type PropsWithChildren, useCallback, useEffect, useState } from "react";
import { useGetGameQuery, WordleTrpc, wordleTrpcClient } from "./hooks";
import { useWordleStore } from "./store";

export function initializeWordleStore( data: Game ) {
	useWordleStore.setState( ( state ) => ( { ...state, gameData: data } ) );
}


export const WordleTrpcProvider = ( props: PropsWithChildren ) => {
	const queryClient = useQueryClient();
	return (
		<WordleTrpc.Provider queryClient={ queryClient } client={ wordleTrpcClient }>
			{ props.children }
		</WordleTrpc.Provider>
	);
};


export const WordleContextProvider = ( props: PropsWithChildren ) => {
	const { gameId } = useLocalSearchParams();
	const { data, isLoading, refetch } = useGetGameQuery( gameId as string );
	const [ refreshing, setRefreshing ] = useState( false );

	const onRefresh = useCallback( async () => {
		setRefreshing( true );
		refetch().then( () => setRefreshing( false ) );
	}, [] );

	useEffect( () => {
		if ( data ) {
			initializeWordleStore( { ...data } );
		}
	}, [ data ] );

	if ( isLoading ) {
		return <Spinner size={ "large" }/>;
	}

	if ( !data ) {
		return <Box>Game Not Found!</Box>;
	}

	return (
		<ScrollView refreshControl={ <RefreshControl refreshing={ refreshing } onRefresh={ onRefresh }/> }>
			<KeyboardAvoidingView>
				{ props.children }
			</KeyboardAvoidingView>
		</ScrollView>
	);
};