import * as Effect from "effect/Effect";

import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";

import { LobbyApi } from "@/lobby/contract";
import { OpenTable } from "@/lobby/schema";
import { Database } from "@/shared/utils/database";
import type { GameId } from "@/swish/schema";
import { PlayerInfo } from "@/swish/schema";
import { gamePlayers, games } from "@/swish/server/tables";
import { withAuth } from "@/swish/utils";


/**
 * How far back the lobby will look, and why it has to look back at all.
 *
 * A game's live document lives in Redis under a 24 hour TTL
 * (`DEFAULT_TIME_TO_LIVE`, `src/swish/server/store.ts`). Nothing ever marks an
 * abandoned table abandoned: a row opened and never joined stays `CREATED`
 * forever, long after the document it points at has expired. Offering one would
 * be offering a seat at a game that no longer exists — `joinGame` answers
 * `GameNotFound` — and it would stay at the top of the list for good.
 *
 * So the window mirrors the TTL rather than approximating it. Inside it a
 * `CREATED` row and a live document mean the same thing; outside it the row is
 * a headstone.
 */
const OPEN_TABLE_WINDOW = sql`now() - interval '24 hours'`;

/** As many tables as anybody will scroll. The lobby is a list, not a search. */
const OPEN_TABLE_LIMIT = 50;

export const LobbyApiLive = HttpApiBuilder.group(
	LobbyApi,
	"lobby",
	Effect.fn( function* ( handlers ) {
		const db = yield* Database;

		/**
		 * The tables still looking for players, newest first.
		 *
		 * A caller's own tables are listed like anybody else's. They are not
		 * joinable — you cannot take a seat you already hold — but they are the
		 * tables most worth showing the person asking: a table you just opened
		 * and are waiting at is the one you want to confirm exists, reopen, or
		 * copy the link from again. Leaving them out made the lobby look empty
		 * to the one person certain to be looking at it. Which rows are the
		 * caller's is left to the client, which knows who it is and already has
		 * every seat in `players`.
		 *
		 * Two queries rather than a join with an aggregate: the seats are wanted
		 * whole — a lobby card shows who is already there — so a grouped join
		 * would either repeat every game row per seat or give back a count this
		 * would then have to fetch the players for anyway. The second query is
		 * keyed by the ids the first returned, which is at most `OPEN_TABLE_LIMIT`
		 * of them and hits `game_players_game_id_idx`.
		 *
		 * `playerCount` is read out of the `config` jsonb because that is where a
		 * game's seat count lives and every config has one. It is a projection and
		 * never a filter, so it costs nothing and needs no column of its own.
		 */
		const openTables = Effect.fn( function* ( game: string | undefined ) {
			const rows = yield* db
				.select( {
					id: games.id,
					game: games.game,
					playerCount: sql<number>`( ${ games.config } ->> 'playerCount' )::int`,
					createdAt: games.createdAt
				} )
				.from( games )
				.where( and(
					eq( games.status, "CREATED" ),
					eq( games.isPrivate, false ),
					gt( games.createdAt, OPEN_TABLE_WINDOW ),
					game ? eq( games.game, game ) : undefined
				) )
				.orderBy( desc( games.createdAt ) )
				.limit( OPEN_TABLE_LIMIT )
				.pipe( Effect.orDie );

			if ( rows.length === 0 ) {
				return [];
			}

			const ids = rows.map( row => row.id );
			const seats = yield* db
				.select( {
					gameId: gamePlayers.gameId,
					playerId: gamePlayers.playerId,
					name: gamePlayers.name,
					avatar: gamePlayers.avatar,
					isBot: gamePlayers.isBot
				} )
				.from( gamePlayers )
				.where( inArray( gamePlayers.gameId, ids ) )
				.pipe( Effect.orDie );

			const byGame = new Map<GameId, Array<PlayerInfo>>();
			for ( const seat of seats ) {
				const player = PlayerInfo.make( {
					id: seat.playerId,
					name: seat.name,
					avatar: seat.avatar,
					isBot: seat.isBot
				} );

				const existing = byGame.get( seat.gameId );
				if ( existing ) {
					existing.push( player );
				} else {
					byGame.set( seat.gameId, [ player ] );
				}
			}

			return rows.map( row => {
				const players = byGame.get( row.id ) ?? [];
				return OpenTable.make( {
					game: row.game,
					gameId: row.id,
					playerCount: row.playerCount,
					seated: players.length,
					players,
					createdAt: row.createdAt.getTime()
				} );
			} );
		} );

		return handlers.handle( "openTables", ( { query } ) => withAuth(
			() => openTables( query.game )
		) );
	} )
);
