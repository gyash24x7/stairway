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

export const players = schema.literaturePlayers;
export const teams = schema.literatureTeams;
export const cardMappings = schema.literatureCardMappings;
export const moves = schema.literatureMoves;
export const games = schema.literatureGames;

export { eq, inArray, and };
