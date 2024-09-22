import { createId } from "@paralleldrive/cuid2";
import { pgSchema, text, timestamp } from "drizzle-orm/pg-core";

export const authSchema = pgSchema( "auth" );

const AVATAR_BASE_URL = "https://api.dicebear.com/7.x/open-peeps/png?seed=";

export const users = authSchema.table( "auth_users", {
	id: text( "id" ).$default( () => createId() ).primaryKey(),
	name: text( "name" ).notNull(),
	email: text( "email" ).notNull().unique(),
	avatar: text( "avatar" ).notNull().$default( () => AVATAR_BASE_URL.concat( createId() ).concat( "&r=50" ) )
} );

export type User = typeof users.$inferSelect;

export const sessions = authSchema.table( "auth_sessions", {
	id: text( "id" ).primaryKey(),
	userId: text( "user_id" ).notNull().references( () => users.id ),
	expiresAt: timestamp( "expires_at", { withTimezone: true, mode: "date" } ).notNull()
} );

export type Session = typeof sessions.$inferSelect;
