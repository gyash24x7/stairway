import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { StairwayAPI } from "@/api.ts";
import { AuthContext } from "@/auth/shared/middleware.ts";
import { ChannelNotFound, ChatMessage, MessageNotAllowed } from "@/chat/shared/schema.ts";
import { Database } from "@/platform/database/service.ts";
import { ChatChannel } from "@/platform/do/chat.ts";
import { generateId } from "@/shared/utils/generator.ts";

import type { ChannelId } from "@/chat/shared/schema.ts";

// --- Chat Http Api Implementation -------------------------------------------------

export const ChatApiLive = HttpApiBuilder.group( StairwayAPI, "chat", handlers =>
	Effect.gen( function* () {
		const db = yield* Database;
		const ns = yield* ChatChannel;

		const getChannel = Effect.fn( function* ( channelId: ChannelId ) {
			const channel = yield* db.query.channels
				.findFirst( { where: { id: channelId } } )
				.pipe( Effect.orDie );

			if ( !channel ) {
				return yield* new ChannelNotFound( { channelId } );
			}

			return channel;
		} );

		return handlers
			.handle( "getHistory", ( { params } ) => Effect.gen( function* () {
				const channel = yield* getChannel( params.channelId );
				const messages = yield* ns.getByName( params.channelId ).history();
				return { policy: channel.policy, messages };
			} ) )

			.handle( "sendMessage", ( { params, payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const channel = yield* getChannel( params.channelId );
				const body = payload.body;

				const isBodyAllowed = body._tag === "chat/Text"
					? channel.policy.text
					: channel.policy.reactions;

				if ( !isBodyAllowed ) {
					return yield* new MessageNotAllowed( {
						reason: body._tag === "chat/Text"
							? "This channel does not allow text messages."
							: "This channel does not allow reactions."
					} );
				}

				const message = ChatMessage.make( {
					id: generateId(),
					at: yield* Clock.currentTimeMillis,
					author: user,
					body
				} );

				return yield* ns.getByName( params.channelId ).postMessage( message );
			} ) );
	} )
);
