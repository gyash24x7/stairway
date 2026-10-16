import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";

import * as Persistable from "effect/persistence/Persistable";
import * as Persistence from "effect/persistence/Persistence";

import { ChatMessage } from "@/chat/schema";


/** How many messages a table keeps. Enough to scroll back through a sitting. */
export const HISTORY_LIMIT = 100;

/**
 * How long a table's backlog is kept after its last message. The same 24 hours
 * the game's own document is kept hot for (`src/swish/server/store.ts`), so the
 * chat lasts as long as the game it belongs to does and no longer.
 */
const TIME_TO_LIVE = Duration.hours( 24 );

class BacklogEntry extends Persistable.Class<{ payload: { room: string } }>()(
	"chat/Backlog",
	{ primaryKey: ( { room } ) => room, success: Schema.Array( ChatMessage ) }
) {}

/**
 * A table's recent messages, kept in Redis under `chat:<game>:<gameId>`.
 *
 * Only the text is kept. Who is in the room and who is in the call live in
 * `ChatRooms`, in memory, and are rebuilt by every client reconnecting; the
 * backlog is the one part of a chat that a reload should not lose. It is never
 * archived to Postgres: a table's talk is for the people at it, and it goes
 * when the game's hot copy does.
 *
 * The whole list is rewritten on each append, since `Persistence` offers no
 * append, and nothing below can tell a write that follows a read from one that
 * lands on top of somebody else's. Appends are therefore run one at a time.
 * That is one lock for every table, which is fine for chat volumes on one
 * process, and keeps a slow write from ever holding up a broadcast — `ChatRooms`
 * delivers a message before it is written here.
 */
export class ChatHistory extends Context.Service<ChatHistory, {
	readonly read: ( room: string ) => Effect.Effect<ReadonlyArray<ChatMessage>>;
	readonly append: ( room: string, message: ChatMessage ) => Effect.Effect<void>;
}>()( "chat/ChatHistory" ) {}

export const ChatHistoryLive = Layer.effect(
	ChatHistory,
	Effect.gen( function* () {
		const persistence = yield* Persistence.Persistence;
		const store = yield* persistence.make( {
			storeId: "chat",
			timeToLive: ( exit ) => Exit.isSuccess( exit ) ? TIME_TO_LIVE : Duration.zero
		} );
		const lock = yield* Semaphore.make( 1 );

		const read = ( room: string ) => store.get( new BacklogEntry( { room } ) ).pipe(
			Effect.map( result => result && Exit.isSuccess( result ) ? result.value : [] ),
			Effect.orDie
		);

		/**
		 * Kept in the order the messages were sent rather than the order they were
		 * written in. Two messages a millisecond apart can reach this the other way
		 * round, since the write happens after the broadcast.
		 */
		const append = ( room: string, message: ChatMessage ) => Effect.gen( function* () {
			const before = yield* read( room );
			const next = [ ...before, message ]
				.sort( ( a, b ) => a.at - b.at )
				.slice( -HISTORY_LIMIT );
			yield* store.set( new BacklogEntry( { room } ), Exit.succeed( next ) ).pipe( Effect.orDie );
		} ).pipe( Semaphore.withPermit( lock ) );

		return ChatHistory.of( { read, append } );
	} )
);
