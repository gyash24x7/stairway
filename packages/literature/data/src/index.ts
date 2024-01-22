import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import type { Sql } from "postgres";
import * as schema from "./literature.schema";

export type * from "./literature.types.js";
export * from "./literature.inputs";

export function createLiteratureDrizzleClient( postgresClient: Sql ) {
	return drizzle( postgresClient, { schema: { ...schema } } );
}

export type LiteratureDrizzleClient = ReturnType<typeof createLiteratureDrizzleClient>;

export const players = schema.players;
export const teams = schema.teams;
export const cardMappings = schema.cardMappings;
export const moves = schema.moves;
export const games = schema.games;

export { eq, inArray, and };
