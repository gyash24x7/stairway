import { defineRelations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { ChatPolicy } from "@/chat/shared/schema.ts";
import { generateAvatar, generateGameCode, generateId } from "@/shared/utils/generator.ts";

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
 */
export const games = sqliteTable(
	"games",
	{
		id: text( "id" ).primaryKey().$default( () => generateId() ),
		code: text( "code" ).notNull().unique().$default( () => generateGameCode() ),
		game: text( "game" ).notNull(),
		completed: integer( "completed", { mode: "boolean" } ).notNull().default( false ),
		createdAt: integer( "created_at", { mode: "timestamp" } ).notNull().$default( now )
	},
	table => [ index( "idx_games_code" ).on( table.code ) ]
);

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
	{ users, passkeys, games, channels },
	t => ( {
		users: {
			passkeys: t.many.passkeys()
		},
		passkeys: {
			user: t.one.users( { from: t.passkeys.userId, to: t.users.id } )
		}
	} )
);