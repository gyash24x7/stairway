import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { SwishArchive, SwishDatabase } from "@/swish/server/services.ts";
import { GameCompletion } from "@/swish/shared/schema.ts";


/**
 * What the outbox does with a finished game once it is off the table.
 *
 * The two stores are written in the order that makes a half-done completion
 * repairable. The archive goes first because it is the copy of the game itself
 * and nothing else can reconstruct it once the Durable Object is cleaned up;
 * the ledger goes second, and it is the write that flips `games.completed` —
 * which is what the read path keys on to look in the archive at all. Filing the
 * archive but not the result leaves a game that still reads as in progress and
 * a redelivery puts right; the other order would point readers at an archive
 * that is not there yet.
 *
 * Both writes are idempotent, which is what makes a redelivery harmless: the
 * archive is keyed by the game, and the result rows are keyed by game and seat.
 * The queue is at-least-once, so this is not an optimisation — a completion
 * arriving twice is ordinary.
 *
 * Nothing here reads a clock or decides a winner. Those were settled by the
 * table that finished the game and travel in the message, so a delivery that
 * lands minutes late — or twice — records the same completion either way.
 *
 * @returns A handler taking one raw queue message body.
 */
export const OutboxConsumerLive = Effect.gen( function* () {
	const archive = yield* SwishArchive;
	const database = yield* SwishDatabase;

	return ( body: unknown ) => Effect.gen( function* () {
		const { address, archive: filed, entries, completedAt } =
			yield* Schema.decodeUnknownEffect( GameCompletion )( body );

		yield* archive.save( address, filed );
		yield* database.recordResults( address, entries, completedAt );
	} );
} );
