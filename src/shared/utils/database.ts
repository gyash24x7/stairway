import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as PgDrizzle from "drizzle-orm/effect-postgres";


const makeDatabase = PgDrizzle.makeWithDefaults();

export class Database extends Context.Service<
	Database,
	Effect.Success<typeof makeDatabase>
>()( "stairway/Database" ) {}

export const DatabaseLive = Layer.effect( Database, makeDatabase );
