import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as Context from "effect/Context";


/** The application's Drizzle ORM client, bound to a Cloudflare D1 database. */
export type Db = DrizzleD1Database;

/**
 * Effect service holding the Drizzle-over-D1 client. The live layer is built by the
 * host (`apps/api`) from alchemy's raw D1 binding — see `makeDrizzle`. Consumers
 * `yield* Database` and wrap the (promise-returning) drizzle calls in `Effect.promise`.
 */
export class Database extends Context.Service<Database, Db>()( "s2h/Database" ) {}

