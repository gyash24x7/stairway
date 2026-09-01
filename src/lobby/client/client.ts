import { client, run } from "@/client.ts";

import type { OpenTableQuery } from "@/lobby/shared/schema.ts";

/**
 * The lobby's one call.
 *
 * Written out rather than built from the wrappers in `swish/client/api.ts`:
 * those three exist to compress the seventy-odd per-game endpoints, all of which
 * are addressed by game id or payload, and none of them carries a query. `auth`
 * calls its own endpoints the same way, for the same reason.
 *
 * @param [game] - Narrow to one kind. Omitted, every kind is listed.
 */
export const listOpenTablesFn = ( game?: string ) => run(
	client.lobby.listOpenTables( {
		query: ( game ? { status: "open", game } : { status: "open" } ) satisfies OpenTableQuery
	} )
);
