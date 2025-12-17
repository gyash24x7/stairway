import { createORPCClient, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { CallbreakClient } from "@s2h/callbreak/router";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "./query.tsx";

const link = new RPCLink( {
	url: window.location.origin + "/api/callbreak",
	interceptors: [
		onError( ( error ) => {
			console.error( error );
		} )
	]
} );

const client: CallbreakClient = createORPCClient( link );
const orpc = createTanstackQueryUtils( client );

export const useCreateGameMutation = ( params: Parameters<typeof orpc.createGame.mutationOptions>[0] ) => {
	return useMutation( orpc.createGame.mutationOptions( params ) );
};

export const useJoinGameMutation = ( params: Parameters<typeof orpc.joinGame.mutationOptions>[0] ) => {
	return useMutation( orpc.joinGame.mutationOptions( params ) );
};

export const useDeclareDealWinsMutation = ( params: Parameters<typeof orpc.declareDealWins.mutationOptions>[0] ) => {
	return useMutation( orpc.declareDealWins.mutationOptions( params ) );
};

export const usePlayCardMutation = ( params: Parameters<typeof orpc.playCard.mutationOptions>[0] ) => {
	return useMutation( orpc.playCard.mutationOptions( params ) );
};

export const ensureGetGameQueryData = ( gameId: string ) => queryClient.ensureQueryData(
	orpc.getGameData.queryOptions( { input: { gameId } } )
);
