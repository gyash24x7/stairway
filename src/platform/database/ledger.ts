import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { gameResults, games } from "@/platform/database/schema.ts";
import { withRuntime } from "@/platform/utils/runtime.ts";
import { SwishLedger } from "@/swish/server/services.ts";

import type { Database } from "@/platform/database/service.ts";

/**
 * The Drizzle handle over this app's D1 database, as `Database` hands it back.
 * Taken as an argument rather than built here so the layer itself needs nothing:
 * a Durable Object resolves the binding once, at the top of its own body, and
 * hands the handle down — exactly as it does with the archive namespace.
 */
type StairwayDb = Effect.Success<typeof Database>;

/**
 * The engine's ledger over D1: a finished game's standings become one
 * `game_results` row per seat, and the game's own row is flagged complete.
 *
 * **The two writes are ordered, not atomic.** D1 has no interactive
 * transaction, so a completion is two statements — and which one goes first
 * decides what a failure between them leaves behind. Rows first: a game whose
 * flag never landed still reads as in progress, and re-running the completion
 * re-files the same rows (the composite key absorbs them) and then flips it.
 * The other order strands a game marked finished with nothing to show for it,
 * which nothing later would think to repair.
 *
 * The row for a seat scoring `undefined` keeps a null `score` rather than a
 * zero: a game that ranks without scoring has no score to report, and a zero
 * would read as one it earned.
 */
export const SwishLedgerLive = ( db: StairwayDb ) =>
	Layer.succeed( SwishLedger, SwishLedger.of( {

		record: ( address, entries, completedAt ) => withRuntime( Effect.gen( function* () {
			if ( entries.length > 0 ) {
				yield* db.insert( gameResults )
					.values( entries.map( entry => ( {
						gameId: address.id,
						game: address.game,
						playerId: entry.playerId,
						rank: entry.rank,
						score: entry.score ?? null,
						team: entry.team ?? null,
						winner: entry.winner,
						completedAt: new Date( completedAt )
					} ) ) )
					.onConflictDoNothing()
					.pipe( Effect.orDie );
			}

			yield* db.update( games )
				.set( { completed: true } )
				.where( eq( games.id, address.id ) )
				.pipe( Effect.orDie );
		} ) )
	} ) );
