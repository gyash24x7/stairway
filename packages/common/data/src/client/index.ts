import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import process from "node:process";
import postgres, { Sql } from "postgres";
import * as authSchema from "../schema/auth.schema";
import * as literatureSchema from "../schema/literature.schema";

export function createDatabaseClient() {
	const connectionString = process.env[ "DATABASE_URL" ]!;
	return postgres( connectionString );
}

export type PostgresClient = Sql;

export type Database<T extends Record<string, unknown>> = PostgresJsDatabase<T>;

function createDrizzleClient<T extends Record<string, unknown>>( dbClient: Sql, schema: T ): Database<T> {
	return drizzle( dbClient, { schema } );
}

export function createAuthDrizzleClient( client: PostgresClient ) {
	return createDrizzleClient( client, authSchema );
}

export function createLiteratureDrizzleClient( client: PostgresClient ) {
	return createDrizzleClient( client, literatureSchema );
}
