import { useMutation, useQuery } from "@tanstack/react-query";
import { orpc } from "./orpc.ts";
import { queryClient } from "./query.tsx";

export const useCreateGameMutation = ( params: Parameters<typeof orpc.wordle.createGame.mutationOptions>[0] ) => {
	return useMutation( orpc.wordle.createGame.mutationOptions( params ) );
};

export const useMakeGuessMutation = ( params: Parameters<typeof orpc.wordle.makeGuess.mutationOptions>[0] ) => {
	return useMutation( orpc.wordle.makeGuess.mutationOptions( params ) );
};

export const ensureGetGameQueryData = ( gameId: string ) => queryClient.ensureQueryData(
	orpc.wordle.getGame.queryOptions( { input: gameId } )
);

export const useGetWordsQuery = ( gameId: string ) => useQuery(
	orpc.wordle.getWords.queryOptions( { input: gameId } )
);