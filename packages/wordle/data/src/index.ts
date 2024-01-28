import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { Sql } from "postgres";
import * as schema from "./wordle.schema";

export * from "./wordle.inputs";
export * from "./wordle.types";


export function createWordleDrizzleClient( postgresClient: Sql ) {
	return drizzle( postgresClient, { schema: { ...schema } } );
}

export type WordleDrizzleClient = ReturnType<typeof createWordleDrizzleClient>;

export const games = schema.wordleGames;

export { eq, inArray, and };