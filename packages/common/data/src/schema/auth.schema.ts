import { createId } from "@paralleldrive/cuid2";
import { pgSchema, text } from "drizzle-orm/pg-core";

export const schema = pgSchema( "auth" );

const AVATAR_BASE_URL = "https://api.dicebear.com/7.x/open-peeps/svg?seed=";

export const users = schema.table( "users", {
	id: text( "id" ).$default( () => createId() ).primaryKey(),
	name: text( "name" ).notNull(),
	email: text( "email" ).notNull(),
	avatar: text( "avatar" ).$default( () => AVATAR_BASE_URL.concat( createId() ).concat( ".svg?r=50" ) ).notNull()
} );
