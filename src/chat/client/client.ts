import { client, run } from "@/client.ts";

import type { ChannelId, ChatBody } from "@/chat/shared/schema.ts";


export const getChatHistoryFn = ( channelId: ChannelId ) =>
	run( client.chat.getHistory( { params: { channelId } } ) );

export const sendChatMessageFn = ( channelId: ChannelId, body: ChatBody ) =>
	run( client.chat.sendMessage( { params: { channelId }, payload: { body } } ) );
