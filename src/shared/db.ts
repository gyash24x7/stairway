import * as authSchema from "@/auth/schema";
import * as callbreakSchema from "@/callbreak/schema";
import * as literatureSchema from "@/literature/schema";
import * as wordleSchema from "@/wordle/schema";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";

const schema = {
	...authSchema,
	...callbreakSchema,
	...literatureSchema,
	...wordleSchema
};

let db: DrizzleD1Database<typeof schema>;

export async function getDb() {
	if ( !db ) {
		const ctx = await getCloudflareContext( { async: true } );
		db = drizzle( ctx.env.DB, { schema } );
	}

	return db;
}