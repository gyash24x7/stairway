import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import {
	ChannelIdParams,
	ChannelNotFound,
	ChatHistory,
	ChatMessage,
	SendMessageError,
	SendMessageInput
} from "@/chat/shared/schema.ts";


// --- Chat Api Group -------------------------------------------------------

const GetHistoryEndpoint = HttpApiEndpoint.get( "getHistory", "/:channelId", {
	params: ChannelIdParams,
	success: ChatHistory,
	error: ChannelNotFound
} );

const SendMessageEndpoint = HttpApiEndpoint.post( "sendMessage", "/:channelId", {
	params: ChannelIdParams,
	payload: SendMessageInput,
	success: ChatMessage,
	error: SendMessageError
} );

export const ChatApiGroup = HttpApiGroup.make( "chat" )
	.add( GetHistoryEndpoint )
	.add( SendMessageEndpoint )
	.prefix( "/chat" )
	.middleware( AuthMiddleware );
