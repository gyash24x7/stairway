import * as authSchema from "@/auth/schema";
import { env } from "cloudflare:workers";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";

const schema = {
	...authSchema
	// ...callbreakSchema,
	// ...literatureSchema,
	// ...wordleSchema
};

let db: DrizzleD1Database<typeof schema>;

export async function getDb() {
	if ( !db ) {
		db = drizzle( env.DB, { schema } );
	}

	return db;
}