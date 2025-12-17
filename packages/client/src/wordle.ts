import { createORPCClient, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { WordleClient } from "@s2h/wordle/router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "./query.tsx";

const link = new RPCLink( {
	url: window.location.origin + "/api/wordle",
	interceptors: [
		onError( ( error ) => {
			console.error( error );
		} )
	]
} );

const client: WordleClient = createORPCClient( link );
const orpc = createTanstackQueryUtils( client );

export const useCreateGameMutation = ( params: Parameters<typeof orpc.createGame.mutationOptions>[0] ) => {
	return useMutation( orpc.createGame.mutationOptions( params ) );
};

export const useMakeGuessMutation = ( params: Parameters<typeof orpc.makeGuess.mutationOptions>[0] ) => {
	return useMutation( orpc.makeGuess.mutationOptions( params ) );
};

export const ensureGetGameQueryData = ( gameId: string ) => queryClient.ensureQueryData(
	orpc.getGameData.queryOptions( { input: { gameId } } )
);

export const useGetWordsQuery = ( gameId: string ) => useQuery(
	orpc.getWords.queryOptions( { input: { gameId } } )
);