import { createORPCClient, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { SplendorClient } from "@s2h/splendor/router";
import type { PlayerGameInfo } from "@s2h/splendor/types";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "./query.tsx";

const link = new RPCLink( {
	url: window.location.origin + "/api/splendor",
	interceptors: [
		onError( ( error ) => {
			console.error( error );
		} )
	]
} );

const client: SplendorClient = createORPCClient( link );
const orpc = createTanstackQueryUtils( client );

export const useCreateGameMutation = ( params: Parameters<typeof orpc.createGame.mutationOptions>[0] ) => {
	return useMutation( orpc.createGame.mutationOptions( params ) );
};

export const useJoinGameMutation = ( params: Parameters<typeof orpc.joinGame.mutationOptions>[0] ) => {
	return useMutation( orpc.joinGame.mutationOptions( params ) );
};

export const useStartGameMutation = ( params: Parameters<typeof orpc.startGame.mutationOptions>[0] ) => {
	return useMutation( orpc.startGame.mutationOptions( params ) );
};

export const usePickTokensMutation = ( params: Parameters<typeof orpc.pickTokens.mutationOptions>[0] ) => {
	return useMutation( orpc.pickTokens.mutationOptions( params ) );
};

export const usePurchaseCardMutation = ( params: Parameters<typeof orpc.purchaseCard.mutationOptions>[0] ) => {
	return useMutation( orpc.purchaseCard.mutationOptions( params ) );
};

export const useReserveCardMutation = ( params: Parameters<typeof orpc.reserveCard.mutationOptions>[0] ) => {
	return useMutation( orpc.reserveCard.mutationOptions( params ) );
};

export const ensureGetGameQueryData = ( gameId: string ) => queryClient.ensureQueryData<PlayerGameInfo>(
	orpc.getGameData.queryOptions( { input: { gameId } } )
);
