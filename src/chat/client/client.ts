import { ChannelId, ChannelIdParams, type ChatBody } from "@/chat/shared/schema.ts";
import { getClient, run } from "@/client.ts";

const API_URL = import.meta.env[ "VITE_API_URL" ] ?? "http://localhost:8787";

const client = getClient( API_URL ).chat;

/** Build the branded `:channelId` path-param struct the endpoints expect. */
const channelIdParams = ( channelId: string ) =>
	ChannelIdParams.make( { channelId: ChannelId.make( channelId ) } );

export const getChatHistoryFn = ( channelId: string, signal?: AbortSignal ) =>
	run( client.getHistory( { params: channelIdParams( channelId ) } ), signal );

export const sendChatMessageFn = ( channelId: string, body: ChatBody ) =>
	run( client.sendMessage( { params: channelIdParams( channelId ), payload: { body } } ) );
