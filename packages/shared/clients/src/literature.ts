import type { router } from "@literature/api";
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
				url: baseUrl + "/api/literature",
				fetch: ( url, options ) => fetch( url, { ...options, credentials: "include" } ),
				transformer: superjson
			} )
		]
	} )
} );

type OnSuccess = ( data: any ) => Promise<void>;

export const literature = {
	getGameDataOptions: ( gameId: string ) => trpc.getGameData.queryOptions( { gameId } ),
	useCreateGameMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.createGame.mutationOptions( { onSuccess } ) ),
	useJoinGameMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.joinGame.mutationOptions( { onSuccess } ) ),
	useAddBotsMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.addBots.mutationOptions( { onSuccess } ) ),
	useCreateTeamsMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.createTeams.mutationOptions( { onSuccess } ) ),
	useStartGameMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.startGame.mutationOptions( { onSuccess } ) ),
	useAskCardMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.askCard.mutationOptions( { onSuccess } ) ),
	useCallSetMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.callSet.mutationOptions( { onSuccess } ) ),
	useTransferTurnMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.transferTurn.mutationOptions( { onSuccess } ) ),
	useExecuteBotMoveMutation: ( onSuccess?: OnSuccess ) => useMutation( trpc.executeBotMove.mutationOptions( { onSuccess } ) )
};