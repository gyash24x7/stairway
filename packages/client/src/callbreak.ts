import { useMutation } from "@tanstack/react-query";
import { orpc } from "./orpc";
import { queryClient } from "./query";

export const useCreateGameMutation = ( params: Parameters<typeof orpc.callbreak.createGame.mutationOptions>[0] ) => {
	return useMutation( orpc.callbreak.createGame.mutationOptions( params ) );
};

export const useJoinGameMutation = ( params: Parameters<typeof orpc.callbreak.joinGame.mutationOptions>[0] ) => {
	return useMutation( orpc.callbreak.joinGame.mutationOptions( params ) );
};

export const useDeclareDealWinsMutation = ( params: Parameters<typeof orpc.callbreak.declareDealWins.mutationOptions>[0] ) => {
	return useMutation( orpc.callbreak.declareDealWins.mutationOptions( params ) );
};

export const usePlayCardMutation = ( params: Parameters<typeof orpc.callbreak.playCard.mutationOptions>[0] ) => {
	return useMutation( orpc.callbreak.playCard.mutationOptions( params ) );
};

export const ensureGetGameQueryData = ( gameId: string ) => queryClient.ensureQueryData(
	orpc.callbreak.getGameData.queryOptions( { input: gameId } )
);
