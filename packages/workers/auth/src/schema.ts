import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable( "users", {
	id: text().primaryKey(),
	name: text().notNull(),
	username: text().notNull().unique(),
	avatar: text().notNull()
} );

export const passkeys = sqliteTable( "passkeys", {
	id: text().primaryKey(),
	publicKey: blob().notNull().$type<Uint8Array<ArrayBuffer>>(),
	counter: integer().notNull().default( 0 ),
	userId: text().notNull()
} );