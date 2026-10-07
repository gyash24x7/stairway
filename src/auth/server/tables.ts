import { sql } from "drizzle-orm";
import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";

import type { PasskeyId, UserId } from "@/auth/schema";


/**
 * The people with an account.
 *
 * `id` is filled by Postgres rather than the app — `uuidv7()` is a builtin as of
 * Postgres 18 — which is why nothing inserts it. `$type` carries the brand the
 * rest of the codebase reads, but it is a compile-time claim only: the row is
 * decoded through the `User` schema on its way out of the repository, since
 * `UserId` also promises the string really is a v7 UUID.
 */
export const users = pgTable( "users", {
	id: uuid().primaryKey().default( sql`uuidv7()` ).$type<UserId>(),
	name: text().notNull(),
	username: text().notNull().unique(),
	avatar: text().notNull()
} );

/**
 * The passkeys registered against an account. One account may hold several.
 *
 * `counter` is the only column that changes after registration: WebAuthn hands
 * back a new signature count on every login and a count that fails to advance is
 * how a cloned authenticator gives itself away.
 */
export const passkeys = pgTable(
	"passkeys",
	{
		id: uuid().primaryKey().default( sql`uuidv7()` ).$type<PasskeyId>(),
		name: text(),
		publicKey: text( "public_key" ).notNull(),
		userId: uuid( "user_id" )
			.notNull()
			.references( () => users.id, { onDelete: "cascade" } )
			.$type<UserId>(),
		credentialId: text( "credential_id" ).notNull(),
		counter: integer().notNull()
	},
	table => [
		index( "passkey_user_id_idx" ).on( table.userId ),
		index( "passkey_credential_id_idx" ).on( table.credentialId )
	]
);

export type UserRow = typeof users.$inferSelect;
export type PasskeyRow = typeof passkeys.$inferSelect;
