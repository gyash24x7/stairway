import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";

import { getChatHistoryFn, sendChatMessageFn } from "@/chat/client/client.ts";
import type { ChatBody, ChatFrame, ChatHistory, ChatMessage } from "@/chat/shared/schema.ts";
import { wsUrl } from "@/sync.ts";

/**
 * Deliberately its own cache key, separate from any game's snapshot key: a chat
 * frame must never be able to clobber a `GameSnapshot`.
 */
export const chatQueryKey = ( channelId: string ) => [ "chat", channelId ];

/**
 * The chat subsystem's one hook. Loads the backlog over HTTP, then keeps it live
 * from the channel's own `/chat/{channelId}` socket — the same
 * `useQuery` + socket-overlay shape the game pages use, but on a wholly separate
 * connection to the `/sync/` one.
 */
export function useChat( channelId: string ) {
	const queryClient = useQueryClient();
	const queryKey = chatQueryKey( channelId );

	const query = useQuery( {
		queryKey,
		queryFn: ( { signal } ) => getChatHistoryFn( channelId, signal ),
		staleTime: Infinity,
		// A channel that doesn't exist won't start existing on a retry.
		retry: false
	} );

	const { lastJsonMessage } = useWebSocket(
		wsUrl( `chat/${ channelId }` ),
		{ shouldReconnect: () => true }
	);

	/** Append unless we already hold it — the sender sees both the POST result and their own frame. */
	const append = ( message: ChatMessage ) =>
		queryClient.setQueryData<ChatHistory>( queryKey, previous => {
			if ( !previous || previous.messages.some( m => m.id === message.id ) ) {
				return previous;
			}

			return { ...previous, messages: [ ...previous.messages, message ] };
		} );

	useEffect( () => {
		const frame = lastJsonMessage as ChatFrame | null;
		if ( frame?._tag === "chat/Frame" ) {
			append( frame.message );
		}
	}, [ lastJsonMessage ] );

	const send = useMutation( {
		mutationFn: ( body: ChatBody ) => sendChatMessageFn( channelId, body ),
		onSuccess: append
	} );

	return {
		messages: query.data?.messages ?? [],
		policy: query.data?.policy,
		isLoading: query.isLoading,
		error: query.error,
		send: send.mutate,
		isSending: send.isPending,
		sendError: send.error
	};
}
