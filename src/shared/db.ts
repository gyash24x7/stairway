import * as authSchema from "@/auth/schema";
import * as callbreakSchema from "@/callbreak/schema";
import * as literatureSchema from "@/literature/schema";
import * as wordleSchema from "@/wordle/schema";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

export async function getDb() {
	const ctx = await getCloudflareContext( { async: true } );
	return drizzle( ctx.env.DB, {
		schema: {
			...authSchema,
			...callbreakSchema,
			...literatureSchema,
			...wordleSchema
		}
	} );
}