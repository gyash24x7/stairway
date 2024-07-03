import { createId } from "@paralleldrive/cuid2";
import { boolean, pgSchema, text } from "drizzle-orm/pg-core";

const AVATAR_BASE_URL = "https://api.dicebear.com/7.x/open-peeps/png?seed=";
export const authSchema = pgSchema( "auth" );

export const users = authSchema.table( "users", {
	id: text( "id" ).notNull().primaryKey().$default( () => createId() ),
	name: text( "name" ).notNull(),
	avatar: text( "avatar" ).notNull().$default( () => AVATAR_BASE_URL.concat( createId() ).concat( "&r=50" ) ),
	email: text( "email" ).notNull().unique(),
	verified: boolean( "verified" ).notNull().default( false ),
	password: text( "password" ).notNull(),
	salt: text( "salt" ).notNull().unique()
} );

export const tokens = authSchema.table( "tokens", {
	id: text( "id" ).notNull().primaryKey(),
	code: text( "code" ).notNull().$default( () => Math.random().toString( 36 ).substring( 2, 15 ) )
} );