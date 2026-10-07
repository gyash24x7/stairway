import * as Schema from "effect/Schema";

import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

import { AuthMiddleware } from "@/auth/contract";
import { OpenTable, OpenTablesQuery } from "@/lobby/schema";


/**
 * `GET /api/lobby/tables?game=<name>` — the tables still looking for players.
 *
 * Authenticated, for two reasons. Only a logged-in caller can act on the list,
 * so an anonymous one would be shown seats it cannot take; and the caller's own
 * id is what lets the query leave out the tables they are already sitting at,
 * which is most of what makes the list readable to the person who just opened
 * one.
 *
 * It fails no way a caller can cause. A lobby with nothing in it is an empty
 * array, not a refusal.
 */
const OpenTablesEndpoint = HttpApiEndpoint.get( "openTables", "/tables", {
	query: OpenTablesQuery,
	success: Schema.Array( OpenTable )
} );

const LobbyApiGroup = HttpApiGroup.make( "lobby" )
	.add( OpenTablesEndpoint )
	.middleware( AuthMiddleware )
	.prefix( "/lobby" );

export const LobbyApi = HttpApi.make( "api" ).add( LobbyApiGroup ).prefix( "/api" );
