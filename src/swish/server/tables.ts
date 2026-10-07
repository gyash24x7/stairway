import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
	boolean,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp
} from "drizzle-orm/pg-core";

import type { CommitId, GameId, GameStatus, PlayerId, TeamId } from "@/swish/schema";


/**
 * The archive of a game: what it was, and how it came out.
 *
 * A row is written when the game is created and then only ever patched — the
 * live game lives in Redis for as long as it is being played, and this table is
 * where it lands once it completes.
 *
 * `config` and `initialState` are the game's own shapes, encoded by the game's
 * own schemas before they get here, so they are opaque `jsonb` at this level.
 * Which game they belong to is `game`.
 *
 * This is also the one part of the archive that is read back while a game is
 * still being played: the lobby lists the tables still looking for players out
 * of here, because Redis is a keyed store with no way to enumerate what is in
 * it. A row reaches `CREATED` the moment the table exists, which is exactly the
 * set the lobby wants.
 *
 * `isPrivate` is a fact about the row rather than a rule of the game, which is
 * why it is a column and not part of the game's `config`. Nothing in the engine
 * reads it and no `view()` carries it — it decides one thing only, whether this
 * table is offered to people who were never sent its link.
 */
export const games = pgTable(
	"games",
	{
		id: text().primaryKey().default( sql`uuidv7()` ).$type<GameId>(),
		game: text().notNull(),
		status: text().notNull().default( "CREATED" ).$type<GameStatus>(),
		isPrivate: boolean( "is_private" ).notNull().default( false ),
		config: jsonb().notNull(),
		initialState: jsonb( "initial_state" ).notNull(),
		rematchOf: text( "rematch_of" ).references( (): AnyPgColumn => games.id ).$type<GameId>(),
		completedAt: timestamp( "completed_at" ),
		createdAt: timestamp( "created_at" ).notNull().defaultNow()
	},
	table => [
		index( "game_name_idx" ).on( table.game ),
		index( "games_open_idx" ).on( table.game, table.status, table.createdAt )
	]
);

/**
 * One seat at one game.
 *
 * `id` is a surrogate: a player can sit at many games and a game seats many
 * players, so neither `playerId` nor `gameId` identifies a row on its own.
 *
 * Everything from `team` down is filled in later — sides while the table is
 * forming, rank and score when the game ends — so all of it is nullable.
 * `score` is a float because the domain's `Standing` says so; the games that
 * score in fractions of a point (callbreak counts in tenths) keep integers only
 * by their own convention.
 */
export const gamePlayers = pgTable(
	"game_players",
	{
		id: text().primaryKey().default( sql`uuidv7()` ),
		gameId: text( "game_id" ).notNull().references( () => games.id ).$type<GameId>(),
		playerId: text( "player_id" ).notNull().$type<PlayerId>(),
		name: text().notNull(),
		avatar: text().notNull(),
		isBot: boolean( "is_bot" ).notNull().default( false ),
		team: text().$type<TeamId>(),
		teamName: text( "team_name" ),
		rank: integer(),
		score: doublePrecision(),
		isWinner: boolean( "is_winner" ).notNull().default( false )
	},
	table => [
		index( "game_players_game_id_idx" ).on( table.gameId ),
		index( "game_players_player_id_idx" ).on( table.playerId ),
		index( "game_players_game_and_player_id_idx" ).on( table.gameId, table.playerId )
	]
);

/**
 * One person who watched one game.
 *
 * Deliberately not a seat, and deliberately not nullable the way `game_players`
 * is: a spectator has no side, no rank, no score and no outcome, so none of the
 * columns that get filled in later exist here. What it has that a seat does not
 * is `joined_at` — a seat's moment is the game's own, but people drift in and
 * out of an audience, and when somebody started watching is the only thing this
 * row could later be asked.
 *
 * `name` and `avatar` are copied rather than joined from `users`, exactly as
 * `game_players` copies them: the archive records who was there as they were
 * then, not as they have since renamed themselves.
 *
 * A row is written once, when somebody asks to watch. Nothing dedupes it here —
 * there is no unique constraint — because the engine refuses a second ask from
 * the same person while the game is live, which is the whole of the window in
 * which one can be made.
 */
export const gameSpectators = pgTable(
	"game_spectators",
	{
		id: text().primaryKey().default( sql`uuidv7()` ),
		gameId: text( "game_id" ).notNull().references( () => games.id ).$type<GameId>(),
		playerId: text( "player_id" ).notNull().$type<PlayerId>(),
		name: text().notNull(),
		avatar: text().notNull(),
		joinedAt: timestamp( "joined_at" ).notNull().defaultNow()
	},
	table => [
		index( "game_spectators_game_id_idx" ).on( table.gameId ),
		index( "game_spectators_player_id_idx" ).on( table.playerId ),
		index( "game_spectators_game_and_player_id_idx" ).on( table.gameId, table.playerId )
	]
);

/**
 * The commit log: one row per command that changed a game, in order.
 *
 * `events` is what actually happened — the engine's events and the game's own,
 * as the game's schema encoded them. The whole log is buffered in Redis for the
 * life of the game and written here in one go when it completes, so a row here
 * is final.
 */
export const gameCommits = pgTable(
	"game_commits",
	{
		id: text().primaryKey().default( sql`uuidv7()` ).$type<CommitId>(),
		gameId: text( "game_id" ).notNull().references( () => games.id ).$type<GameId>(),
		at: timestamp().notNull(),
		command: text().notNull(),
		actor: text().notNull().$type<PlayerId>(),
		moveType: text( "move_type" ),
		events: jsonb().notNull()
	},
	table => [ index( "game_commits_game_id_idx" ).on( table.gameId ) ]
);

export type GameRow = typeof games.$inferSelect;
export type GamePlayerRow = typeof gamePlayers.$inferSelect;
export type GameSpectatorRow = typeof gameSpectators.$inferSelect;
export type GameCommitRow = typeof gameCommits.$inferSelect;
