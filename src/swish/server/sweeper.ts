import * as Effect from "effect/Effect";

import { SwishDatabase } from "@/swish/server/services.ts";

import type { GameId } from "@/swish/shared/schema.ts";


/**
 * What the sweeper needs of one game's Durable Object namespace: a way to reach
 * a table by id and empty it. Deliberately not the engine's whole client — the
 * sweep is the one caller that wants nothing the game can tell it, so narrowing
 * to `cleanup` is what keeps a game-agnostic pass from having to know seven
 * `EngineClient` instantiations apart.
 */
export type GameCleaner = ( id: GameId ) => Effect.Effect<void>;

/**
 * How many games one pass clears.
 *
 * Each game is a Durable Object round trip, and a scheduled invocation has a
 * wall-clock budget, so the pass is bounded rather than draining the table in
 * one go. Clearing less than the backlog is safe *because* the flag is written:
 * a swept row stops answering the query, so the next pass starts where this one
 * stopped instead of at the front again. At a fire every two days this covers
 * far more than a table produces.
 */
export const SWEEP_BATCH_SIZE = 100;

/**
 * The periodic pass that gives a finished game's Durable Object back.
 *
 * A completed game is already somewhere else: the outbox filed the whole thing
 * in the archive, and only then moved `games.status` to `COMPLETED` — which is what sends
 * a reader to the archive rather than to the object. So from that flip onward
 * the object's commit log, checkpoints and materialized record are a second copy
 * nobody reads, and the storage they occupy is the only thing they cost. This
 * hands it back.
 *
 * **Cleared first, marked second**, and the order is the whole of the failure
 * story. A pass that empties an object and then fails to write the flag leaves a
 * row the next pass picks up again, and clearing storage that is already empty
 * costs one no-op — the repeat is free. The other order strands an object marked
 * swept and still full, and nothing downstream would ever think to look at it
 * again. Marking is one write for the whole batch rather than one per game,
 * because a hundred round trips to D1 is the expensive half of a pass that is
 * otherwise all Durable Object calls.
 *
 * A game whose object refuses to clear is logged and left unmarked, and the rest
 * of the batch continues: one unreachable table is not a reason to abandon the
 * ninety-nine behind it, and leaving it unmarked is exactly what schedules the
 * retry.
 *
 * @param getCleaner - The object namespace per game kind, by the name the `games`
 *   table stores. A kind with no entry is logged and skipped rather than marked,
 *   so a game removed from the worker before its tables were swept keeps them.
 * @returns The pass, returning how many games it cleared.
 */
export const GameSweeper = ( getCleaner: ( game: string ) => GameCleaner | undefined ) =>
	Effect.gen( function* () {
		const database = yield* SwishDatabase;

		return Effect.gen( function* () {
			const pending = yield* database.findCleanableGames( SWEEP_BATCH_SIZE );
			const swept: Array<GameId> = [];

			for ( const address of pending ) {
				const cleaner = getCleaner( address.game );

				if ( !cleaner ) {
					yield* Effect.logWarning(
						`Sweep skipped ${ address.game }:${ address.id } — no durable object bound for that game`
					);
					continue;
				}

				const cleared = yield* cleaner( address.id ).pipe(
					Effect.as( true ),
					Effect.catchCause( cause =>
						Effect.logError( `Sweep failed for ${ address.game }:${ address.id }`, cause ).pipe(
							Effect.as( false )
						)
					)
				);

				if ( cleared ) {
					swept.push( address.id );
				}
			}

			yield* database.markCleanedUp( swept );
			return swept.length;
		} );
	} );
