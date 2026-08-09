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
// A standalone, game-agnostic channel API. A channel is addressed by its id and
// nothing else: the handlers validate it against the `channels` table and never
// consult a game, an engine, or a snapshot.
//
// Note the REST surface is `/api/chat/...` (the whole `HttpApi` is prefixed
// `/api`) while the realtime socket is `/chat/{channelId}`, handled directly in
// the worker's `fetch` — so the two never collide.

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
