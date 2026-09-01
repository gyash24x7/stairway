import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { SwishArchive, SwishDatabase } from "@/swish/server/services.ts";
import { SwishOutboxMessage, TableProjection } from "@/swish/shared/schema.ts";


/**
 * What the outbox does with the two things a table tells the outside world.
 *
 * A status change is one guarded write and nothing else — the store keeps it
 * only if it is newer than what the row already holds, so an out-of-order or
 * repeated delivery costs a no-op rather than a wrong answer.
 *
 * A completion is three writes, and their order is the whole of the failure
 * story. The archive goes first because it is the copy of the game itself and
 * nothing else can reconstruct it once the Durable Object is swept. The result
 * rows go second. The status flip goes *last*, because that is what the read
 * path keys on to look in the archive at all: filing the archive but not the
 * status leaves a game that still reads as in progress and a redelivery puts
 * right, while flipping the status first would point readers at an archive that
 * is not there yet.
 *
 * This is also why a {@link TableStatusChanged} may never carry `COMPLETED` —
 * it would be exactly that forbidden early flip, arriving on the path that does
 * not write an archive.
 *
 * Every write is idempotent, which is what makes a redelivery harmless: the
 * archive is keyed by the game, the result rows by game and seat, and the status
 * by version. The queue is at-least-once, so this is not an optimisation — a
 * message arriving twice is ordinary.
 *
 * Nothing here reads a clock or decides a winner. Those were settled by the
 * table the message came from, so a delivery that lands minutes late — or twice
 * — records the same thing either way.
 *
 * @returns A handler taking one raw queue message body.
 */
export const OutboxConsumerLive = Effect.gen( function* () {
	const archive = yield* SwishArchive;
	const database = yield* SwishDatabase;

	return ( body: unknown ) => Effect.gen( function* () {
		const message = yield* Schema.decodeUnknownEffect( SwishOutboxMessage )( body );

		const projection = TableProjection.make( {
			version: message.version,
			status: message.status,
			seatsTaken: message.seatsTaken,
			playerCount: message.playerCount
		} );

		if ( message._tag === "swish/msg/TableStatusChanged" ) {
			return yield* database.syncStatus( message.address, projection );
		}

		yield* archive.save( message.address, message.archive );
		yield* database.recordResults( message.address, message.entries, message.completedAt );
		yield* database.syncStatus( message.address, projection );
	} );
} );
