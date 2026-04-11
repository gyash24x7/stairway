import { generateAvatar, generateId } from "@/shared/utils/generator";
import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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