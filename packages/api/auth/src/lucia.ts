import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { drizzle } from "drizzle-orm/postgres-js";
import { Lucia } from "lucia";
import postgres from "postgres";
import { sessions, User, users } from "./schema.ts";

const sql = postgres( process.env[ "DATABASE_URL" ]! );
export const db = drizzle( sql, { schema: { sessions, users } } );

const adapter = new DrizzlePostgreSQLAdapter( db, sessions, users );

export const lucia = new Lucia( adapter, {
	sessionCookie: {
		name: "auth_session",
		expires: false,
		attributes: {
			secure: process.env[ "NODE_ENV" ] === "production"
		}
	},
	getUserAttributes( attributes ) {
		return { ...attributes };
	}
} );

declare module "lucia" {
	interface Register {
		Lucia: typeof lucia;
		DatabaseUserAttributes: User;
	}
}
