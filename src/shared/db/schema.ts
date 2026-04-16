import { generateAvatar, generateGameCode, generateId } from "@/shared/utils/generator";
import { blob, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const games = sqliteTable(
	"games",
	{
		id: text().primaryKey().$default( () => generateId() ),
		code: text().notNull().unique().$default( () => generateGameCode() ),
		game: text().notNull(),
		completed: integer().notNull().default( 0 ).$type<0 | 1>(),
		createdAt: text().notNull().$default( () => new Date().toISOString() )
	},
	table => [ index( "idx_games_code" ).on( table.code ) ]
);
