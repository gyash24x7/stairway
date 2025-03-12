import type { router } from "@wordle/api";
import type { Wordle } from "@stairway/types/wordle";
import { useMutation } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { baseUrl, queryClient } from "./query.client";

const trpc = createTRPCOptionsProxy<typeof router>( {
	queryClient,
	client: createTRPCClient<typeof router>( {
		links: [
			httpBatchLink( {
				url: baseUrl + "/api/wordle",
				fetch: ( url, options ) => fetch( url, { ...options, credentials: "include" } )
			} )
		]
	} )
} );

type OnSuccess = ( game: Wordle.Game ) => Promise<void>;

export const wordle = {
	getGameOptions: ( gameId: string ) => trpc.getGame.queryOptions( { gameId } ),
	useCreateGameMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.createGame.mutationOptions( { onSuccess } ) ),
	useMakeGuessMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.makeGuess.mutationOptions( { onSuccess } ) )
};