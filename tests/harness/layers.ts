import * as Layer from "effect/Layer";

import * as TestRunner from "effect/cluster/TestRunner";
import * as Persistence from "effect/persistence/Persistence";

import { makeTestDatabase } from "@tests/harness/database";
import { makeTestGenerator } from "@tests/harness/generator";


/**
 * Everything a game entity needs, with nothing outside this process.
 *
 * Three substitutions, each for one production layer:
 * - `TestRunner.layer` for `SingleRunner.layer()` — the same `Sharding`, with
 *   in-memory message and runner storage instead of SQL. It is the reason an
 *   entity can be driven at all without a database behind it.
 * - `Persistence.layerMemory` for `Persistence.layerRedis` — the hot store
 *   (`swish:<game>:<gameId>`) in a map rather than in Redis.
 * - a recording stub for `Database` — the ledger's only seam.
 *
 * The `Generator` stub is not a substitution for infrastructure but for
 * randomness: it fixes the game id, and through it every draw the engine makes.
 *
 * @param name - Namespace for this environment's generated ids.
 * @returns The layer, plus the ledger log and id list for assertions.
 */
export const makeTestEnv = ( name: string ) => {
	const database = makeTestDatabase();
	const generator = makeTestGenerator( name );

	const layer = Layer.mergeAll(
		TestRunner.layer,
		Persistence.layerMemory,
		database.layer,
		generator.layer
	);

	return { layer, ledger: database.log, ids: generator.issued } as const;
};
