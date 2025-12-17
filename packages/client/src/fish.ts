import { createORPCClient, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { FishClient } from "@s2h/fish/router";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "./query.tsx";

const link = new RPCLink( {
	url: window.location.origin + "/api/fish",
	interceptors: [
		onError( ( error ) => {
			console.error( error );
		} )
	]
} );

const client: FishClient = createORPCClient( link );
const orpc = createTanstackQueryUtils( client );

export const useCreateGameMutation = ( params: Parameters<typeof orpc.createGame.mutationOptions>[0] ) => {
	return useMutation( orpc.createGame.mutationOptions( params ) );
};

export const useJoinGameMutation = ( params: Parameters<typeof orpc.joinGame.mutationOptions>[0] ) => {
	return useMutation( orpc.joinGame.mutationOptions( params ) );
};

export const useCreateTeamsMutation = ( params: Parameters<typeof orpc.createTeams.mutationOptions>[0] ) => {
	return useMutation( orpc.createTeams.mutationOptions( params ) );
};

export const useStartGameMutation = ( params: Parameters<typeof orpc.startGame.mutationOptions>[0] ) => {
	return useMutation( orpc.startGame.mutationOptions( params ) );
};

export const useAskCardMutation = ( params: Parameters<typeof orpc.askCard.mutationOptions>[0] ) => {
	return useMutation( orpc.askCard.mutationOptions( params ) );
};

export const useClaimBookMutation = ( params: Parameters<typeof orpc.claimBook.mutationOptions>[0] ) => {
	return useMutation( orpc.claimBook.mutationOptions( params ) );
};

export const useTransferTurnMutation = ( params: Parameters<typeof orpc.transferTurn.mutationOptions>[0] ) => {
	return useMutation( orpc.transferTurn.mutationOptions( params ) );
};

export const ensureGetGameQueryData = ( gameId: string ) => queryClient.ensureQueryData(
	orpc.getGameData.queryOptions( { input: { gameId } } )
);
