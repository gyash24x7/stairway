import { generateAvatar, generateId } from "@/shared/utils/generator";
import { blob, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable( "auth_users", {
	id: text( "id" ).primaryKey().$default( () => generateId() ),
	name: text( "name" ).notNull(),
	username: text( "username" ).notNull().unique(),
	avatar: text( "avatar" ).notNull().$default( () => generateAvatar() )
} );

export const passkeys = sqliteTable( "auth_passkeys", {
	id: text( "id" ).primaryKey(),
	publicKey: blob( "public_key" ).notNull().$type<Uint8Array<ArrayBufferLike>>(),
	userId: text( "user_id" ).notNull().references( () => users.id ),
	webauthnUserId: text( "webauthn_user_id" ).notNull(),
	counter: integer( "counter" ).notNull(),
	deviceType: text( "device_type" ).notNull(),
	backedUp: integer( "backed_up" ).notNull().default( 0 ),
	transports: text( "transports" )
} );