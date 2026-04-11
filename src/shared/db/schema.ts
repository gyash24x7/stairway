import { generateAvatar, generateGameCode, generateId } from "@/shared/utils/generator";
import { defineRelations } from "drizzle-orm";
import { blob, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable( "users", {
	id: text().primaryKey().$default( () => generateId() ),
	name: text().notNull(),
	username: text().notNull().unique(),
	avatar: text().notNull().$default( () => generateAvatar() )
} );

export const passkeys = sqliteTable( "passkeys", {
	id: text().primaryKey().$default( () => generateId() ),
	publicKey: blob().notNull().$type<Uint8Array<ArrayBuffer>>(),
	counter: integer().notNull().default( 0 ),
	userId: text().notNull()
} );

export const webauthnOptions = sqliteTable( "webauthn_options", {
	username: text().primaryKey(),
	challenge: text().notNull()
} );

type MatchStatus = "CREATED" | "PLAYERS_READY" | "IN_PROGRESS" | "COMPLETED";

export const matches = sqliteTable(
	"matches",
	{
		id: text().primaryKey().$default( () => generateId() ),
		code: text().notNull().unique().$default( () => generateGameCode() ),
		game: text().notNull(),
		config: text().notNull(),
		status: text().notNull().default( "CREATED" ).$type<MatchStatus>(),
		state: text().notNull(),
		result: text(),
		createdAt: text().notNull().$default( () => new Date().toISOString() )
	},
	table => [ index( "idx_matches_code" ).on( table.code ) ]
);

export const matchPlayers = sqliteTable(
	"match_players",
	{
		matchId: text().notNull().references( () => matches.id, { onDelete: "cascade" } ),
		playerId: text().notNull().references( () => users.id, { onDelete: "cascade" } ),
		name: text().notNull(),
		avatar: text().notNull().$default( () => generateAvatar() ),
		isBot: integer().notNull().default( 0 ).$type<0 | 1>()
	},
	table => [
		primaryKey( { columns: [ table.matchId, table.playerId ] } ),
		index( "idx_match_players_playerId" ).on( table.playerId ),
		index( "idx_match_players_matchId" ).on( table.matchId )
	]
);

export const relations = defineRelations(
	{ users, passkeys, webauthnOptions, matches, matchPlayers },
	r => ( {
		users: {
			passkeys: r.many.passkeys()
		},
		matches: {
			players: r.many.matchPlayers()
		}
	} )
);