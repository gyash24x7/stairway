import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export const StairwayDatabase = Cloudflare.D1.Database( "StairwayDB", {
	migrationsDir: "./migrations",
	migrationsTable: "drizzle_migrations"
} );

export class Database extends Context.Service<Database, DrizzleD1Database>()(
	"stairway/Database"
) {}

export const DatabaseLive = Layer.effect(
	Database,
	Effect.gen( function* () {
		const query = yield* Cloudflare.D1.QueryDatabase( StairwayDatabase );
		const raw = yield* query.raw;
		return Database.of( drizzle( raw ) );
	} )
).pipe(
	Layer.provide( Cloudflare.D1.QueryDatabaseBinding ),
	Layer.provide( Alchemy.RuntimeContext.phantom )
);

export * as ops from "drizzle-orm/sql";