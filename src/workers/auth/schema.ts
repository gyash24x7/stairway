import { generateAvatar, generateId } from "@/utils/generator";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable( "auth_users", {
	id: text().notNull().primaryKey().$default( () => generateId() ),
	name: text().notNull(),
	username: text().notNull().unique(),
	avatar: text().notNull().$default( () => generateAvatar() )
} );

export const passkeys = sqliteTable( "auth_passkeys", {
	id: text().notNull().primaryKey().$default( () => generateId() ),
	publicKey: text( { mode: "json" } ).notNull().$type<Uint8Array<ArrayBufferLike>>(),
	webauthnUserId: text().notNull(),
	counter: integer().notNull(),
	createdAt: integer().notNull().$default( () => Date.now() ),
	userId: text().notNull().references( () => users.id )
} );