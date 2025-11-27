import { useMutation } from "@tanstack/react-query";
import { orpc } from "./orpc";
import { queryClient } from "./query";

export const useCreateGameMutation = ( params: Parameters<typeof orpc.fish.createGame.mutationOptions>[0] ) => {
	return useMutation( orpc.fish.createGame.mutationOptions( params ) );
};

export const useJoinGameMutation = ( params: Parameters<typeof orpc.fish.joinGame.mutationOptions>[0] ) => {
	return useMutation( orpc.fish.joinGame.mutationOptions( params ) );
};

export const useCreateTeamsMutation = ( params: Parameters<typeof orpc.fish.createTeams.mutationOptions>[0] ) => {
	return useMutation( orpc.fish.createTeams.mutationOptions( params ) );
};

export const useStartGameMutation = ( params: Parameters<typeof orpc.fish.startGame.mutationOptions>[0] ) => {
	return useMutation( orpc.fish.startGame.mutationOptions( params ) );
};

export const useAskCardMutation = ( params: Parameters<typeof orpc.fish.askCard.mutationOptions>[0] ) => {
	return useMutation( orpc.fish.askCard.mutationOptions( params ) );
};

export const useClaimBookMutation = ( params: Parameters<typeof orpc.fish.claimBook.mutationOptions>[0] ) => {
	return useMutation( orpc.fish.claimBook.mutationOptions( params ) );
};

export const useTransferTurnMutation = ( params: Parameters<typeof orpc.fish.transferTurn.mutationOptions>[0] ) => {
	return useMutation( orpc.fish.transferTurn.mutationOptions( params ) );
};

export const ensureGetGameQueryData = ( gameId: string ) => queryClient.ensureQueryData(
	orpc.fish.getGameData.queryOptions( { input: gameId } )
);
