import { client, run } from "@/client.ts";

import type { ChannelId } from "@/chat/shared/schema.ts";
import type { ChatBody } from "@/chat/shared/schema.ts";


export const getChatHistoryFn = ( channelId: ChannelId, signal?: AbortSignal ) =>
	run( client.chat.getHistory( { params: { channelId } } ), signal );

export const sendChatMessageFn = ( channelId: ChannelId, body: ChatBody ) =>
	run( client.chat.sendMessage( { params: { channelId }, payload: { body } } ) );
