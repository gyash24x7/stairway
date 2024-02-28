import { drizzle } from "drizzle-orm/postgres-js";
import type { Sql } from "postgres";
import * as schema from "./auth.schema";

export const users = schema.users;

export type User = typeof schema.users.$inferSelect;

export function createAuthDrizzleClient( postgresClient: Sql ) {
	return drizzle( postgresClient, { schema: { ...schema } } );
}

export type AuthDrizzleClient = ReturnType<typeof createAuthDrizzleClient>;