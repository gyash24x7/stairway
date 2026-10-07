import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { eq } from "drizzle-orm";

import { Database } from "@/shared/utils/database";
import type {
	BaseGameConfig,
	BaseGameEvent,
	Commit,
	GameContext,
	GameId,
	GameStatus,
	Genesis,
	PlayerId,
	PlayerInfo,
	Standings,
	TeamId
} from "@/swish/schema";
import { gameCommits, gamePlayers, games, gameSpectators } from "@/swish/server/tables";


// --- Ledger ---------------------------------------------------------------

/**
 * Where a game goes once it is over.
 *
 * A row is written when the table is created and patched as the game moves
 * through its statuses; the log itself only arrives at the end, when the engine
 * archives the game out of Redis. Used by lobby api to list the open games.
 */
export const makeGameLedger =
	<State, Config extends BaseGameConfig, Events extends BaseGameEvent>( name: string ) =>
		Effect.gen( function* () {
			const db = yield* Database;

			const teamDataFor = ( playerId: PlayerId, context: GameContext ) => {
				const team = context.teams[ playerId ] ?? null;
				return { team, teamName: ( team && context.teamNames[ team ] ) ?? null };
			};

			const outcomeFor = ( playerId: PlayerId, results: Standings, team: TeamId | null ) => {
				const standing = results.ranking.find( entry => entry.playerId === playerId );
				const isWinner = results.winningTeam
					? team === results.winningTeam
					: results.winner === playerId;

				return {
					rank: standing?.rank ?? null,
					score: standing?.score ?? null,
					isWinner
				};
			};

			return {
				/**
				 * Opens the row for a new table.
				 *
				 * `isPrivate` arrives alongside the genesis rather than inside it,
				 * because it is not part of what the game *is*: the genesis is the
				 * fixed truth a replay is folded onto, and visibility changes nothing
				 * a replay would produce. It is written here and read only by the
				 * lobby's query.
				 */
				createNew: Effect.fn( function* (
					{ id, config, initialState }: Genesis<State, Config>,
					isPrivate: boolean,
					/**
					 * The game this one is a rematch of, when it is one. Written here
					 * rather than patched in afterwards because it is as fixed as the
					 * genesis beside it: which table a table came from never changes.
					 */
					rematchOf?: GameId
				) {
					const rows = yield* db.insert( games )
						.values( { id, game: name, config, initialState, isPrivate, rematchOf } )
						.returning()
						.pipe( Effect.orDie );

					return rows[ 0 ]!;
				} ),

				updateStatus: Effect.fn( function* ( id: GameId, status: GameStatus ) {
					yield* db.update( games )
						.set( { status } )
						.where( eq( games.id, id ) )
						.pipe( Effect.orDie );
				} ),

				createPlayer: Effect.fn( function* ( gameId: GameId, { id, ...rest }: PlayerInfo ) {
					yield* db.insert( gamePlayers )
						.values( { gameId, playerId: id, ...rest } )
						.pipe( Effect.orDie );
				} ),

				/**
				 * Records that somebody watched.
				 *
				 * Spelled out field by field rather than spread like `createPlayer`,
				 * because `PlayerInfo` carries an `isBot` this table has no column for:
				 * bots are given seats, never an audience.
				 *
				 * Nothing here guards against writing the same person twice. The engine
				 * does, from the live document, and that is the only window in which a
				 * second ask can be made — once the game is archived the document is gone
				 * and so is any way to ask again.
				 */
				createSpectator: Effect.fn( function* (
					gameId: GameId,
					{ id, name, avatar }: PlayerInfo
				) {
					yield* db.insert( gameSpectators )
						.values( { gameId, playerId: id, name, avatar } )
						.pipe( Effect.orDie );
				} ),

				updateTeams: Effect.fn( function* ( gameId: GameId, context: GameContext ) {
					yield* db.transaction( tx => Effect.gen( function* () {
						const seats = yield* tx
							.select( { id: gamePlayers.id, playerId: gamePlayers.playerId } )
							.from( gamePlayers ).where( eq( gamePlayers.gameId, gameId ) );

						yield* Effect.forEach(
							seats,
							seat => tx.update( gamePlayers )
								.set( teamDataFor( seat.playerId, context ) )
								.where( eq( gamePlayers.id, seat.id ) ),
							{ discard: true }
						);
					} ) ).pipe( Effect.orDie );
				} ),

				/**
				 * Stamps each seat with how it finished, and the game with when it did.
				 *
				 * Both tables in one transaction: a game that says it completed while its
				 * seats still hold no result is a row nobody can interpret.
				 *
				 * The seat's own `team` is read back and handed to `outcomeFor`, which is
				 * what makes `isWinner` mean anything in a team game — it compares the
				 * seat's side against the winning one, and was previously called without
				 * a side at all, so no seat in a team game was ever marked a winner.
				 */
				updateResults: Effect.fn( function* ( gameId: GameId, results: Standings ) {
					const completedAt = DateTime.toDateUtc( yield* DateTime.now );

					yield* db.transaction( tx => Effect.gen( function* () {
						const seats = yield* tx.select().from( gamePlayers )
							.where( eq( gamePlayers.gameId, gameId ) );

						yield* Effect.forEach(
							seats,
							seat => tx.update( gamePlayers )
								.set( outcomeFor( seat.playerId, results, seat.team ) )
								.where( eq( gamePlayers.id, seat.id ) ),
							{ discard: true }
						);

						yield* tx.update( games ).set( { completedAt } ).where( eq( games.id, gameId ) );
					} ) ).pipe( Effect.orDie );
				} ),

				/**
				 * Writes the finished game's log.
				 *
				 * One multi-row insert rather than a transaction of many: a single
				 * statement is its own transaction, so the whole log still lands or none
				 * of it does, in one round trip instead of `n` plus a begin and a commit.
				 */
				recordCommits: Effect.fn( function* ( gameId: GameId, log: Commit<Events>[] ) {
					if ( log.length === 0 ) {
						return;
					}

					const rows = log.map( commit => ( {
						id: commit.id,
						gameId,
						at: new Date( commit.at ),
						command: commit.meta.command,
						actor: commit.meta.actor,
						moveType: commit.meta.moveType ?? null,
						events: commit.events
					} ) );

					yield* db.insert( gameCommits ).values( rows ).pipe( Effect.orDie );
				} )
			};
		} );
