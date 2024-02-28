import { createId } from "@paralleldrive/cuid2";
import { pgSchema, text } from "drizzle-orm/pg-core";

export const authSchema = pgSchema( "auth" );

const AVATAR_BASE_URL = "https://api.dicebear.com/7.x/open-peeps/svg?seed=";

export const users = authSchema.table( "users", {
	id: text( "id" ).$default( () => createId() ).notNull(),
	name: text( "name" ).notNull(),
	avatar: text( "avatar" ).notNull().$default( () => AVATAR_BASE_URL.concat( createId() ).concat( ".svg?r=50" ) ),
	email: text( "email" ).notNull().unique()
} );

