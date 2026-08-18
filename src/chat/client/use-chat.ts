import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Schema from "effect/Schema";
import { useCallback, useEffect } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";

import { getChatHistoryFn, sendChatMessageFn } from "@/chat/client/client.ts";
import { ChannelId, ChatMessage } from "@/chat/shared/schema.ts";
import { wsUrl } from "@/client.ts";

import type { ChatBody, ChatHistory } from "@/chat/shared/schema.ts";

/**
 * Deliberately its own cache key, separate from any game's snapshot key: a chat
 * frame must never be able to clobber a `GameSnapshot`.
 */
export const chatQueryKey = ( channelId: string ) => [ "chat", channelId ];

export function useChat( props: { channelId: string } ) {
	const channelId = ChannelId.make( props.channelId );
	const queryClient = useQueryClient();
	const queryKey = chatQueryKey( channelId );

	const query = useQuery( {
		queryKey,
		queryFn: ( { signal } ) => getChatHistoryFn( channelId, signal ),
		staleTime: Infinity,
		retry: false
	} );

	const { lastJsonMessage } = useWebSocket(
		wsUrl( `chat/${ channelId }` ),
		{ shouldReconnect: () => true }
	);

	const append = useCallback( ( message: ChatMessage ) =>
		queryClient.setQueryData<ChatHistory>( queryKey, previous => {
			if ( !previous || previous.messages.some( m => m.id === message.id ) ) {
				return previous;
			}

			return { ...previous, messages: [ ...previous.messages, message ] };
		} ), [ queryClient, queryKey ] );

	useEffect( () => {
		if ( lastJsonMessage !== null ) {
			append( Schema.decodeUnknownSync( ChatMessage )( lastJsonMessage ) );
		}

	}, [ lastJsonMessage, append ] );

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
