import { useAuthInfo } from "@auth/ui";
import { CardHand, PlayingCard } from "@common/cards";
import { Box, KeyboardAvoidingView, RefreshControl, ScrollView, Spinner } from "@gluestack-ui/themed";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { type PropsWithChildren, useCallback, useEffect, useState } from "react";
import { LiteratureTrpc, literatureTrpcClient, useGetGameDataQuery } from "./hooks.ts";
import { type PlayerGameData, useLiteratureStore } from "./store.ts";

export function initializeLiteratureStore( data: PlayerGameData ) {
	useLiteratureStore.setState( ( state ) => ( {
		...state,
		data: {
			gameData: { ...state.data.gameData, ...data.gameData },
			playerId: data.playerId,
			hand: data.hand,
			cardLocations: data.cardLocations
		}
	} ) );
}


export const LiteratureTrpcProvider = ( props: PropsWithChildren ) => {
	const queryClient = useQueryClient();
	return (
		<LiteratureTrpc.Provider queryClient={ queryClient } client={ literatureTrpcClient }>
			{ props.children }
		</LiteratureTrpc.Provider>
	);
};


export const LiteratureContextProvider = ( props: PropsWithChildren ) => {
	const { gameId } = useLocalSearchParams();
	const authInfo = useAuthInfo();
	const { data, isLoading, refetch } = useGetGameDataQuery( gameId as string );

	const [ refreshing, setRefreshing ] = useState( false );

	const onRefresh = useCallback( async () => {
		setRefreshing( true );
		refetch().then( () => setRefreshing( false ) );
	}, [] );

	useEffect( () => {
		if ( data ) {
			initializeLiteratureStore( {
				...data,
				playerId: authInfo!.id,
				hand: CardHand.from( data.hand?.map( PlayingCard.from ) ?? [] )
			} );
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