import type { router } from "@callbreak/api";
import { useMutation } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import { baseUrl, queryClient } from "./query.client";

const trpc = createTRPCOptionsProxy<typeof router>( {
	queryClient,
	client: createTRPCClient<typeof router>( {
		links: [
			httpBatchLink( {
				url: baseUrl + "/api/callbreak",
				fetch: ( url, options ) => fetch( url, { ...options, credentials: "include" } ),
				transformer: superjson
			} )
		]
	} )
} );


type OnSuccess = ( data: any ) => Promise<void>;

export const callbreak = {
	getGameDataOptions: ( gameId: string ) => trpc.getGameData.queryOptions( { gameId } ),
	useCreateGameMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.createGame.mutationOptions( { onSuccess } ) ),
	useJoinGameMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.joinGame.mutationOptions( { onSuccess } ) ),
	useAddBotsMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.addBots.mutationOptions( { onSuccess } ) ),
	useDeclareDealWinsMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.declareDealWins.mutationOptions( { onSuccess } ) ),
	usePlayCardMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.playCard.mutationOptions( { onSuccess } ) )
};