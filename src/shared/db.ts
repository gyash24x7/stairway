import * as schema from "@/auth/schema";
import { env } from "cloudflare:workers";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";

let db: DrizzleD1Database<typeof schema>;

export function getDb() {
	return !db ? db = drizzle( env.DB as D1Database, { schema } ) : db;
}