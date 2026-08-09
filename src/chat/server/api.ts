import * as Cloudflare from "alchemy/Cloudflare";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

import { StairwayAPI } from "@/api.ts";
import { AuthContext } from "@/auth/shared/middleware.ts";
import { SessionService, SessionServiceLive } from "@/auth/server/session.ts";
import {
	admitMessage,
	isBodyAllowed,
	KEY_MSG_PREFIX,
	KEY_SEQ,
	messageKey
} from "@/chat/server/rules.ts";
import {
	ChannelNotFound,
	ChatFrame,
	ChatMessage,
	MessageNotAllowed,
	TooManyMessages
} from "@/chat/shared/schema.ts";
import { toPlayerInfo } from "@/client.ts";
import { Database } from "@/platform/database/service.ts";
import { SessionStoreLive } from "@/platform/kv/session.ts";
import { generateId } from "@/shared/utils/generator.ts";

interface Attachment {
	readonly userId: string;
}


// --- Durable Object ----------------------------------------------------------

/**
 * One instance per channel. Owns the channel's sockets and its message history,
 * and nothing else — it has no idea whether the channel belongs to a game, and
 * never reads game state.
 *
 * Policy is *not* enforced here: the `channels` row lives in D1, which the API
 * group already holds a `Database` handle for, so the check happens there (see
 * `ChatApiLive`) and this stays a dumb append-and-fan-out.
 */
export class ChatChannelDO extends Cloudflare.DurableObject<ChatChannelDO>()(
	"ChatChannelDO",
	Effect.gen( function* () {
		const state = yield* Cloudflare.DurableObjectState;
		const sessionService = yield* SessionService;

		return Effect.gen( function* () {
			// Keyed by socket, not by attachment. `GameChannel` keys by a fresh
			// object literal and then deletes by `deserializeAttachment()` — a
			// different identity, so its sockets are never actually removed.
			const sessions = new Map<Cloudflare.WebSocket, Attachment>();

			for ( const socket of yield* state.getWebSockets() ) {
				const attachment = socket.deserializeAttachment<Attachment>();
				if ( attachment ) {
					sessions.set( socket, attachment );
				}
			}

			/** Recent post timestamps per user. In-memory: resetting on hibernation is fine. */
			const recentPosts = new Map<string, ReadonlyArray<number>>();

			const broadcast = Effect.fn( function* ( message: ChatMessage ) {
				const frame = JSON.stringify( ChatFrame.make( { message } ) );
				for ( const socket of sessions.keys() ) {
					yield* socket.send( frame ).pipe( Effect.ignore );
				}
			} );

			return {
				fetch: Effect.gen( function* () {
					const authInfo = yield* sessionService.load();
					if ( !authInfo ) {
						return HttpServerResponse.text( "Unauthorized", { status: 401 } );
					}

					const [ response, socket ] = yield* Cloudflare.upgrade();
					const attachment: Attachment = { userId: authInfo.id };
					socket.serializeAttachment<Attachment>( attachment );
					sessions.set( socket, attachment );
					return response;
				} ),

				webSocketClose: Effect.fn( function* (
					ws: Cloudflare.WebSocket,
					code: number,
					reason: string
				) {
					sessions.delete( ws );
					yield* ws.close( code, reason );
				} ),

				/** Append a message and fan it out. The caller has already vetted it. */
				postMessage: Effect.fn( function* ( message: ChatMessage ) {
					const now = yield* Clock.currentTimeMillis;
					const admission = admitMessage( recentPosts.get( message.author.id ) ?? [], now );
					recentPosts.set( message.author.id, admission.recent );

					if ( !admission.allowed ) {
						return yield* new TooManyMessages();
					}

					const seq = ( yield* state.storage.get<number>( KEY_SEQ ) ) ?? 0;
					yield* state.storage.put( messageKey( seq ), message );
					yield* state.storage.put( KEY_SEQ, seq + 1 );

					yield* broadcast( message );
					return message;
				} ),

				/** The full backlog, oldest first. */
				history: Effect.fn( function* () {
					const stored = yield* state.storage.list<ChatMessage>( { prefix: KEY_MSG_PREFIX } );
					return [ ...stored.values() ];
				} )
			};
		} );
	} ).pipe(
		Effect.provide( SessionServiceLive ),
		Effect.provide( SessionStoreLive ),
		Effect.provide( Cloudflare.KV.ReadWriteNamespaceBinding )
	)
) {}

export type ChatChannelNamespace = Cloudflare.DurableObject<ChatChannelDO>;


// --- HTTP Api implementation -------------------------------------------------

export const ChatApiLive = HttpApiBuilder.group( StairwayAPI, "chat", handlers =>
	Effect.gen( function* () {
		const db = yield* Database;
		const ns = yield* ChatChannelDO;

		/** A channel exists iff it has a row. This is the whole authorization model. */
		const requireChannel = Effect.fn( function* ( channelId: string ) {
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
				// A valid session is required, but not membership of anything: chat
				// carries no private information and channel ids are unguessable.
				yield* AuthContext;

				const channel = yield* requireChannel( params.channelId );
				const messages = yield* ns.getByName( params.channelId ).history();
				return { policy: channel.policy, messages };
			} ) )

			.handle( "sendMessage", ( { params, payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const channel = yield* requireChannel( params.channelId );
				const body = payload.body;

				if ( !isBodyAllowed( channel.policy, body ) ) {
					return yield* new MessageNotAllowed( {
						reason: body._tag === "chat/Text"
							? "This channel does not allow text messages."
							: "This channel does not allow reactions."
					} );
				}

				const message = ChatMessage.make( {
					id: generateId(),
					at: yield* Clock.currentTimeMillis,
					author: toPlayerInfo( user ),
					body
				} );

				return yield* ns.getByName( params.channelId ).postMessage( message );
			} ) );
	} )
);
