import { defineRelations } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	real,
	sqliteTable,
	text,
	uniqueIndex
} from "drizzle-orm/sqlite-core";

import { generateAvatar, generateGameCode, generateId } from "@/shared/utils/generator.ts";

import type { ChatPolicy } from "@/chat/shared/schema.ts";
import type { GameStatus } from "@/swish/shared/schema.ts";

const now = () => new Date();

/**
 * The users table storing user profiles with auto-generated IDs and avatars.
 */
export const users = sqliteTable( "users", {
	id: text( "id" ).primaryKey().$default( () => generateId() ),
	name: text( "name" ).notNull(),
	email: text( "email" ).notNull().unique(),
	emailVerified: integer( "email_verified", { mode: "boolean" } ).notNull().default( false ),
	image: text( "image" ).$default( () => generateAvatar() ),
	createdAt: integer( "created_at", { mode: "timestamp" } ).notNull().$default( now ),
	updatedAt: integer( "updated_at", { mode: "timestamp" } ).notNull().$default( now )
} );

/**
 * The passkeys table storing WebAuthn credential public keys
 * and counters for each user
 */
export const passkeys = sqliteTable(
	"passkeys",
	{
		id: text( "id" ).primaryKey().$default( () => generateId() ),
		name: text( "name" ),
		publicKey: text( "public_key" ).notNull(),
		userId: text( "user_id" ).notNull().references( () => users.id, { onDelete: "cascade" } ),
		credentialID: text( "credential_id" ).notNull(),
		counter: integer( "counter" ).notNull(),
		deviceType: text( "device_type" ).notNull(),
		backedUp: integer( "backed_up", { mode: "boolean" } ).notNull(),
		transports: text( "transports" ),
		aaguid: text( "aaguid" ),
		createdAt: integer( "created_at", { mode: "timestamp" } ).$default( now )
	},
	( t ) => [
		index( "passkey_user_id_idx" ).on( t.userId ),
		index( "passkey_credential_id_idx" ).on( t.credentialID )
	]
);

/**
 * The games table tracking all game instances
 * with auto-generated IDs and join codes.
 *
 * `rematchOf` names the finished game this one was started from, and its unique
 * index is what makes a rematch happen once. A table full of people all pressing
 * the button at the end of a game is the ordinary case, not the rare one, so the
 * insert that has to happen anyway is also the lock: whoever's row lands first
 * owns the rematch, and everyone else reads it back and joins that game instead
 * of starting a second one. NULLs are distinct under SQLite's UNIQUE, so every
 * game that is nobody's rematch coexists happily.
 *
 * `status`, `seatsTaken` and `playerCount` are a *replica*, not a source. The
 * lifecycle is folded from a commit log inside the game's Durable Object, and
 * this row is what that object publishes about itself so the outside world can
 * ask questions the object cannot answer at scale — above all "which tables can
 * I still join?", which is a query over every game at once and so cannot be a
 * fan-out of calls to each of them.
 *
 * The seat counts are replicated rather than joined from `players` because they
 * would be wrong if they were: a bot holds a seat but never gets a row there, so
 * a table filled by one person and three machines would count as one and be
 * advertised as having three seats free. `playerCount` defaults to `0` rather
 * than being nullable for the same reason, but pointing the other way — the
 * `seatsTaken < playerCount` test a listing runs then fails closed, so a table
 * stays invisible until its object has actually said how big it is.
 *
 * `statusVersion` is the log position the replica was taken at, and the only
 * thing that makes it safe. The messages carrying these updates are delivered at
 * least once and in no particular order, so a write keeps only what is newer
 * than the row already holds; a redelivery and a message overtaken by a later
 * one are then the same harmless case.
 *
 * `cleanedUp` is the sweeper's mark, not a fact about the game: a finished game
 * is filed in the archive and its Durable Object holds nothing anyone reads
 * again, so a periodic pass erases that storage and ticks this flag so the next
 * pass skips the row. It is separate from `status` because the two say different
 * things — `status` is where a reader should look for the game, `cleanedUp` is
 * whether its object has already been emptied — and because moving `status` for
 * a second purpose would send readers to an archive before it was written.
 * `idx_games_sweep` is the index the pass reads through: the pair is the whole
 * of its query, and the table is mostly rows it has already dealt with.
 *
 * `isPrivate` is the one column here that is neither a replica nor a mark: it is
 * a choice the creator made, written on the insert, and never revised. It sits
 * beside the replicated columns rather than among them because it must be right
 * from the first moment the row exists — the others may be briefly unknown, and
 * an unknown table is hidden anyway, but a table meant to be hidden cannot be
 * public even for the length of a queue hop.
 *
 * `idx_games_open` serves the other direction — the lobby's "open, public tables
 * of this kind, newest first": equality on the first three columns and ordering
 * on the fourth.
 */
export const games = sqliteTable(
	"games",
	{
		id: text( "id" ).primaryKey().$default( () => generateId() ),
		code: text( "code" ).notNull().unique().$default( () => generateGameCode() ),
		game: text( "game" ).notNull(),
		isPrivate: integer( "is_private", { mode: "boolean" } ).notNull().default( false ),
		status: text( "status" ).$type<GameStatus>().notNull().default( "CREATED" ),
		statusVersion: integer( "status_version" ).notNull().default( 0 ),
		seatsTaken: integer( "seats_taken" ).notNull().default( 0 ),
		playerCount: integer( "player_count" ).notNull().default( 0 ),
		cleanedUp: integer( "cleaned_up", { mode: "boolean" } ).notNull().default( false ),
		rematchOf: text( "rematch_of" ),
		createdAt: integer( "created_at", { mode: "timestamp" } ).notNull().$default( now )
	},
	table => [
		index( "idx_games_code" ).on( table.code ),
		uniqueIndex( "idx_games_rematch_of" ).on( table.rematchOf ),
		index( "idx_games_sweep" ).on( table.status, table.cleanedUp ),
		index( "idx_games_open" ).on( table.status, table.isPrivate, table.game, table.createdAt )
	]
);

/**
 * The players table tracking the players who joined
 * a particular game. Doesn't include bots.
 */
export const players = sqliteTable(
	"players",
	{
		id: text( "id" ).$default( () => generateId() ),
		name: text( "name" ).notNull(),
		avatar: text( "image" ).$default( () => generateAvatar() ),
		gameId: text( "gameId" ).references( () => games.id, { onDelete: "cascade" } )
	},
	table => [
		primaryKey( { name: "players_pk", columns: [ table.id, table.gameId ] } ),
		index( "idx_players_id" ).on( table.id ),
		index( "idx_players_gameId" ).on( table.gameId )
	]
);

/**
 * The results table: one row per seat of a finished game, written once when the
 * engine completes it. This is the warm record of an outcome — what a profile,
 * a leaderboard or a head-to-head is queried from — while the archive namespace
 * keeps the cold, full game beside it.
 *
 * Keyed on the game and the seat together, so recording a completion twice
 * (a retried Durable Object call, a re-run alarm) lands the same rows rather
 * than a second set beside the first.
 *
 * `playerId` carries no foreign key on purpose: a bot holds a seat and is ranked
 * like anyone else, but never has a row in `players`. A query about people joins
 * `players` and drops the machines; a query about the table does not have to.
 *
 * `score` is `real` because a game's points are only a number — the engine's
 * `Standings` never promises they are whole, and a game scoring in fractions
 * would otherwise be silently truncated on the way in.
 */
export const gameResults = sqliteTable(
	"game_results",
	{
		gameId: text( "game_id" ).notNull().references( () => games.id, { onDelete: "cascade" } ),
		game: text( "game" ).notNull(),
		playerId: text( "player_id" ).notNull(),
		rank: integer( "rank" ).notNull(),
		score: real( "score" ),
		team: text( "team" ),
		winner: integer( "winner", { mode: "boolean" } ).notNull().default( false ),
		completedAt: integer( "completed_at", { mode: "timestamp" } ).notNull().$default( now )
	},
	table => [
		primaryKey( { name: "game_results_pk", columns: [ table.gameId, table.playerId ] } ),
		index( "idx_game_results_player_id" ).on( table.playerId ),
		index( "idx_game_results_game" ).on( table.game )
	]
);

/**
 * The channels table tracking all the chat channels
 * created.
 */
export const channels = sqliteTable(
	"channels",
	{
		id: text( "id" ).primaryKey(),
		refType: text( "ref_type" ).notNull(),
		refId: text( "ref_id" ).notNull(),
		label: text( "label" ),
		policy: text( "policy", { mode: "json" } ).notNull().$type<ChatPolicy>(),
		createdAt: integer( "created_at", { mode: "timestamp" } ).notNull().$default( now )
	},
	table => [ index( "idx_channels_ref" ).on( table.refType, table.refId ) ]
);

export const relations = defineRelations(
	{ users, passkeys, games, players, channels, gameResults },
	t => ( {
		users: {
			passkeys: t.many.passkeys()
		},
		passkeys: {
			user: t.one.users( { from: t.passkeys.userId, to: t.users.id } )
		},
		players: {
			game: t.one.games( { from: t.players.gameId, to: t.games.id } )
		},
		games: {
			players: t.many.players(),
			results: t.many.gameResults()
		},
		gameResults: {
			gameRow: t.one.games( { from: t.gameResults.gameId, to: t.games.id } )
		}
	} )
);
