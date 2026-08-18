import * as Effect from "effect/Effect";

import { DurableStorage } from "@/platform/do/storage.ts";
import { WebSocketChannel } from "@/platform/do/ws.ts";

import type { ChatMessage } from "@/chat/shared/schema.ts";

// --- Chat Service Methods -----------------------------------------------------

export const ChatService = Effect.gen( function* () {
	const storage = yield* DurableStorage;
	const channel = yield* WebSocketChannel;

	return {
		history: Effect.fn( function* () {
			return yield* storage.list<ChatMessage>( "msg:" );
		} ),

		postMessage: Effect.fn( function* ( message: ChatMessage ) {
			yield* storage.transaction(
				Effect.fn( function* ( txn ) {
					const seq = ( yield* txn.get<number>( "seq" ) ) ?? 0;
					const messageKey = `msg:${ String( seq ).padStart( 12, "0" ) }`;
					yield* txn.put( messageKey, message );
					yield* txn.put( "seq", seq + 1 );
				} )
			);

			yield* channel.broadcast( JSON.stringify( message ) );
			return message;
		} )
	};
} );
