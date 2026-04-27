import { generateAvatar, generateGameCode, generateId } from "@/shared/utils/generator";
import { blob, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** The users table storing user profiles with auto-generated IDs and avatars. */
export const users = sqliteTable( "users", {
	id: text().primaryKey().$default( () => generateId() ),
	name: text().notNull(),
	username: text().notNull().unique(),
	avatar: text().notNull().$default( () => generateAvatar() )
} );

/** The passkeys table storing WebAuthn credential public keys and counters for each user. */
export const passkeys = sqliteTable( "passkeys", {
	id: text().primaryKey().$default( () => generateId() ),
	publicKey: blob().notNull().$type<Uint8Array<ArrayBuffer>>(),
	counter: integer().notNull().default( 0 ),
	userId: text().notNull()
} );

/** Temporary table for WebAuthn challenge storage during registration and login flows. */
export const webauthnOptions = sqliteTable( "webauthn_options", {
	username: text().primaryKey(),
	challenge: text().notNull()
} );

/** The games table tracking all game instances with auto-generated IDs and join codes. */
export const games = sqliteTable(
	"games",
	{
		id: text().primaryKey().$default( () => generateId() ),
		code: text().notNull().unique().$default( () => generateGameCode() ),
		game: text().notNull(),
		completed: integer().notNull().default( 0 ).$type<0 | 1>(),
		createdAt: integer().notNull().$default( () => Date.now() / 1000 )
	},
	table => [ index( "idx_games_code" ).on( table.code ) ]
);
