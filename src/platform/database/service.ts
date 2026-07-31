import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle";
import * as Effect from "effect/Effect";

import { relations } from "@/platform/database/schema.ts";

export const StairwayDatabase = Effect.gen( function* () {
	const schema = yield* Drizzle.Schema( "StairwaySchema", {
		schema: "./src/platform/database/schema.ts",
		out: "./migrations",
		dialect: "sqlite"
	} );

	return yield* Cloudflare.D1.Database( "StairwayDB", {
		migrationsDir: schema.out,
		migrationsTable: "drizzle_migrations"
	} );
} );

export const Database = Effect.gen( function* () {
	const database = yield* Cloudflare.D1.QueryDatabase( StairwayDatabase );
	return yield* Drizzle.D1( database, { relations } );
} );
