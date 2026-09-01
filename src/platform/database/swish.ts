import { and, asc, eq, inArray, lt } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { gameResults, games, players } from "@/platform/database/schema.ts";
import { Database } from "@/platform/database/service.ts";
import { withRuntime } from "@/platform/utils/runtime.ts";
import { SwishDatabase } from "@/swish/server/services.ts";
import { GameAddress, GameCode, GameId, GameNotFound, GameRef } from "@/swish/shared/schema.ts";

/**
 * The `games` row as a {@link GameRef}. Both fields are branded on the way out,
 * because the column types are bare text and everything downstream of here
 * addresses a game by the brand.
 */
const toRef = ( row: { readonly id: string; readonly code: string } ) => GameRef.make( {
	id: GameId.make( row.id ),
	code: GameCode.make( row.code )
} );

/**
 * Swish's relational store over D1.
 *
 * Every read is scoped by the game's kind as well as its key, so a table of one
 * game can never answer for another, and every write that a caller may repeat is
 * written to absorb the repeat rather than to throw on it — a re-join, a lost
 * rematch race and a redelivered completion are all ordinary here.
 *
 * Errors die rather than surfacing: the service's methods declare no error
 * channel, because a database that is refusing writes is not a decision any
 * caller can act on.
 */
export const SwishDatabaseLive = Layer.effect( SwishDatabase, Effect.gen( function* () {
	const db = yield* Database;

	return SwishDatabase.of( {

		findGame: ( address ) => withRuntime(
			Effect.gen( function* () {
				const game = yield* db.query.games
					.findFirst( { where: address } )
					.pipe( Effect.orDie );

				if ( !game ) {
					return yield* new GameNotFound( { id: address.id } );
				}

				return game;
			} )
		),

		findGameByCode: ( name, code ) => withRuntime(
			Effect.gen( function* () {
				const game = yield* db.query.games
					.findFirst( { where: { code, game: name } } )
					.pipe( Effect.orDie );

				if ( !game ) {
					return yield* new GameNotFound( { code } );
				}

				return toRef( game );
			} )
		),

		findRematch: ( game, sourceId ) => withRuntime(
			db.query.games
				.findFirst( { where: { rematchOf: sourceId, game } } )
				.pipe( Effect.map( row => row && toRef( row ) ), Effect.orDie )
		),

		createGame: ( game, isPrivate ) => withRuntime(
			db.insert( games )
				.values( { game, isPrivate } )
				.returning()
				.pipe( Effect.map( ( [ row ] ) => toRef( row! ) ), Effect.orDie )
		),

		/**
		 * The conflict is scoped to `rematch_of` rather than left bare, so a code
		 * collision cannot be misread as a lost race — a collision is a broken
		 * generator and should surface, while losing the race is the ordinary case.
		 */
		claimRematch: ( game, sourceId, isPrivate ) => withRuntime(
			db.insert( games )
				.values( { game, rematchOf: sourceId, isPrivate } )
				.onConflictDoNothing( { target: games.rematchOf } )
				.returning()
				.pipe( Effect.map( ( [ row ] ) => row && toRef( row ) ), Effect.orDie )
		),

		seatPlayers: ( gameId, seats ) => withRuntime( Effect.gen( function* () {
			if ( seats.length === 0 ) {
				return;
			}

			yield* db.insert( players )
				.values( seats.map( seat => ( { ...seat, gameId } ) ) )
				.onConflictDoNothing()
				.pipe( Effect.orDie );
		} ) ),

		/**
		 * Only the rows — marking the game over belongs to {@link syncStatus}, which
		 * owns that column. Keeping the two apart is what lets the caller order the
		 * three writes a completion needs, and D1 has no interactive transaction, so
		 * that order is the only thing standing between a crash and a completion
		 * nothing later would think to repair.
		 *
		 * Re-running is free: the composite key absorbs the same rows rather than
		 * filing a second set beside them.
		 *
		 * The row for a seat scoring `undefined` keeps a null `score` rather than a
		 * zero: a game that ranks without scoring has no score to report, and a zero
		 * would read as one it earned.
		 */
		recordResults: ( address, entries, completedAt ) => withRuntime( Effect.gen( function* () {
			if ( entries.length === 0 ) {
				return;
			}

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
		} ) ),

		/**
		 * The one writer of the replica a table keeps outside its Durable Object.
		 *
		 * `statusVersion` is the whole of the concurrency story. These updates arrive
		 * over an at-least-once queue in no guaranteed order, so the row keeps only
		 * what is strictly newer than it already holds: a redelivery compares equal
		 * and a message overtaken by a later one compares lower, and both fall out as
		 * a zero-row update rather than as an error or a regression. That is sound
		 * only because the engine publishes from commits a rewind can never reach —
		 * see the message's own doc comment.
		 *
		 * Scoped by kind as well as id, like every read here: a game of another kind
		 * is not this one, and a primary key alone would let one answer for the other.
		 */
		syncStatus: ( address, projection ) => withRuntime(
			db.update( games )
				.set( {
					status: projection.status,
					statusVersion: projection.version,
					seatsTaken: projection.seatsTaken,
					playerCount: projection.playerCount
				} )
				.where( and(
					eq( games.id, address.id ),
					eq( games.game, address.game ),
					lt( games.statusVersion, projection.version )
				) )
				.pipe( Effect.orDie )
		),

		/**
		 * Oldest first, so a backlog drains in the order it accumulated rather than
		 * having the same recent rows re-read by every pass while the old ones sit.
		 */
		findCleanableGames: limit => withRuntime(
			db.select( { id: games.id, game: games.game } )
				.from( games )
				.where( and( eq( games.status, "COMPLETED" ), eq( games.cleanedUp, false ) ) )
				.orderBy( asc( games.createdAt ) )
				.limit( limit )
				.pipe(
					Effect.map( rows => rows.map( row => GameAddress.make( {
						game: row.game,
						id: GameId.make( row.id )
					} ) ) ),
					Effect.orDie
				)
		),

		markCleanedUp: ids => withRuntime( Effect.gen( function* () {
			if ( ids.length === 0 ) {
				return;
			}

			yield* db.update( games )
				.set( { cleanedUp: true } )
				.where( inArray( games.id, ids ) )
				.pipe( Effect.orDie );
		} ) )
	} );
} ) );
