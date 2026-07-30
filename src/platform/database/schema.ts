import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
 * Temporary table for WebAuthn challenge storage
 * during registration and login flows.
 */
export const verifications = sqliteTable(
	"verifications",
	{
		id: text( "id" ).primaryKey().$default( () => generateId() ),
		identifier: text( "identifier" ).notNull(),
		value: text( "value" ).notNull(),
		expiresAt: integer( "expires_at", { mode: "timestamp" } ).notNull(),
		createdAt: integer( "created_at", { mode: "timestamp" } ).notNull().$default( now ),
		updatedAt: integer( "updated_at", { mode: "timestamp" } ).notNull().$default( now )
	},
	( t ) => [ index( "verification_identifier_idx" ).on( t.identifier ) ]
);

/**
 * Server-side sessions. The row id doubles as the opaque token
 * carried in the signed cookie.
 */
export const sessions = sqliteTable(
	"sessions",
	{
		id: text( "id" ).primaryKey().$default( () => generateId() ),
		token: text( "token" ).notNull().unique(),
		userId: text( "user_id" ).notNull().references( () => users.id, { onDelete: "cascade" } ),
		expiresAt: integer( "expires_at", { mode: "timestamp" } ).notNull(),
		ipAddress: text( "ip_address" ),
		userAgent: text( "user_agent" ),
		createdAt: integer( "created_at", { mode: "timestamp" } ).notNull().$default( now ),
		updatedAt: integer( "updated_at", { mode: "timestamp" } ).notNull().$default( now )
	},
	table => [ index( "session_user_id_idx" ).on( table.userId ) ]
);

/**
 * Accounts table used by better auth
 */
export const accounts = sqliteTable(
	"accounts",
	{
		id: text( "id" ).primaryKey().$default( () => generateId() ),
		accountId: text( "account_id" ).notNull(),
		providerId: text( "provider_id" ).notNull(),
		userId: text( "user_id" ).notNull().references( () => users.id, { onDelete: "cascade" } ),
		accessToken: text( "access_token" ),
		refreshToken: text( "refresh_token" ),
		idToken: text( "id_token" ),
		accessTokenExpiresAt: integer( "access_token_expires_at", { mode: "timestamp" } ),
		refreshTokenExpiresAt: integer( "refresh_token_expires_at", { mode: "timestamp" } ),
		scope: text( "scope" ),
		password: text( "password" ),
		createdAt: integer( "created_at", { mode: "timestamp" } ).notNull().$default( now ),
		updatedAt: integer( "updated_at", { mode: "timestamp" } ).notNull().$default( now )
	},
	table => [ index( "account_user_id_idx" ).on( table.userId ) ]
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