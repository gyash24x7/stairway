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
 */
export const games = sqliteTable(
	"games",
	{
		id: text( "id" ).primaryKey().$default( () => generateId() ),
		code: text( "code" ).notNull().unique().$default( () => generateGameCode() ),
		game: text( "game" ).notNull(),
		completed: integer( "completed", { mode: "boolean" } ).notNull().default( false ),
		rematchOf: text( "rematch_of" ),
		createdAt: integer( "created_at", { mode: "timestamp" } ).notNull().$default( now )
	},
	table => [
		index( "idx_games_code" ).on( table.code ),
		uniqueIndex( "idx_games_rematch_of" ).on( table.rematchOf )
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
