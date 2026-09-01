import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import { AuthMiddleware } from "@/auth/shared/middleware.ts";
import { OpenTable, OpenTableQuery } from "@/lobby/shared/schema.ts";

/**
 * `GET /games?status=open` — the tables anyone could sit down at right now,
 * across every kind, newest first.
 *
 * This is the one question about games that is not about *a* game, which is why
 * it lives in a group of its own rather than in any of the seven per-game ones:
 * asking each of them in turn would be seven round trips to answer a question
 * the relational store can answer in one.
 *
 * It answers from the store alone and never reaches a Durable Object. That is
 * only possible because every table publishes its own shape as it changes, and
 * it is what keeps the cost of the lobby independent of how many tables are open.
 *
 * There is no declared error. A miss is an empty list rather than a failure —
 * "nobody is waiting" is an ordinary answer — and a store that is refusing reads
 * is not something a caller can act on.
 */
const ListOpenTablesEndpoint = HttpApiEndpoint.get( "listOpenTables", "/", {
	query: OpenTableQuery,
	success: Schema.Array( OpenTable )
} );

/**
 * The cross-game group, prefixed `/games` so the endpoint reads as a question
 * about games in general.
 *
 * Behind `AuthMiddleware` like every group but `auth`: taking a seat requires an
 * account, so browsing without one could only ever end at a sign-in prompt, and
 * an unauthenticated live feed of join codes is a scraping surface for nothing.
 */
export const LobbyApiGroup = HttpApiGroup.make( "lobby" )
	.add( ListOpenTablesEndpoint )
	.prefix( "/games" )
	.middleware( AuthMiddleware );
