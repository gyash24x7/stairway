import { and, desc, eq, gte, lt } from "drizzle-orm";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { StairwayAPI } from "@/api.ts";
import { OPEN_TABLE_LIMIT, OPEN_TABLE_MAX_AGE_MS, OpenTable } from "@/lobby/shared/schema.ts";
import { games } from "@/platform/database/schema.ts";
import { Database } from "@/platform/database/service.ts";
import { GameCode, GameId } from "@/swish/shared/schema.ts";

/**
 * Which rows count as open.
 *
 * Split out from the handler so it can be exercised against a real database
 * rather than only read: the predicate is the whole of the feature's
 * correctness, and most of its clauses guard against states that are easy to
 * describe and easy to get wrong.
 *
 * A private table is excluded here rather than filtered further up, so that
 * there is exactly one place a table can be offered from, and so exactly one
 * place the question can be got wrong.
 *
 * @param since - The oldest table still worth offering.
 * @param [game] - Narrow to one kind.
 */
export const openTablesWhere = ( since: Date, game?: string ) => and(
	eq( games.status, "CREATED" ),
	eq( games.isPrivate, false ),
	lt( games.seatsTaken, games.playerCount ),
	gte( games.createdAt, since ),
	game ? eq( games.game, game ) : undefined
);

/** The columns a listing answers with. */
export const openTableColumns = {
	id: games.id,
	code: games.code,
	game: games.game,
	seatsTaken: games.seatsTaken,
	playerCount: games.playerCount,
	createdAt: games.createdAt
};

/**
 * The lobby, which is one query.
 *
 * **What makes a table open.** It must be public — a private table is reachable
 * only through the code its creator hands out, which is the whole point of the
 * option. Beyond that: a game admits a joiner only while it is `CREATED`
 * or `PLAYERS_READY`, and refuses a full roster before either — so the joinable
 * set is `CREATED` *with a free seat*. Both halves are load-bearing.
 * `PLAYERS_READY` is only ever reached by the roster filling, so it is always
 * full; and a table under `autoStart` never reaches it at all, sitting at
 * `CREATED` for the few seconds between its last seat filling and the timer that
 * starts it. Listing on status alone would therefore advertise every autostarting
 * table as joinable during exactly the window in which it is not, and every click
 * would race into `GameFull`.
 *
 * **Why the seat counts are columns.** They are replicated from each game's own
 * record rather than counted from `players`, because bots hold seats and never
 * reach that table — a game filled by one person and three machines would count
 * as one, and be offered as having three seats free.
 *
 * **Why this can be one query at all.** Every table publishes its own shape as it
 * changes, so the store already knows the answer; the alternative — asking each
 * game's Durable Object in turn — would cost one round trip per open table.
 *
 * The read is slightly behind: the projection travels over a queue, so a table
 * that has just filled can still be listed for a moment. That is why joining is
 * allowed to fail, and why `GameFull` and `GameNotJoinable` are already part of
 * every game's join contract — losing the race is an ordinary outcome, not an
 * error state this endpoint should try to prevent.
 *
 * `idx_games_open` covers the whole of it: equality on `status` and `game`, then
 * `created_at` for both the age floor and the ordering.
 */
export const LobbyApiLive = HttpApiBuilder.group( StairwayAPI, "lobby", handlers =>
	Effect.gen( function* () {
		const db = yield* Database;

		return handlers.handle( "listOpenTables", ( { query } ) => Effect.gen( function* () {
			const now = yield* Clock.currentTimeMillis;
			const since = new Date( now - OPEN_TABLE_MAX_AGE_MS );

			const rows = yield* db.select( openTableColumns )
				.from( games )
				.where( openTablesWhere( since, query.game ) )
				.orderBy( desc( games.createdAt ) )
				.limit( OPEN_TABLE_LIMIT )
				.pipe( Effect.orDie );

			return rows.map( row => OpenTable.make( {
				id: GameId.make( row.id ),
				code: GameCode.make( row.code ),
				game: row.game,
				seatsTaken: row.seatsTaken,
				playerCount: row.playerCount,
				createdAt: row.createdAt.getTime()
			} ) );
		} ) );
	} )
);
