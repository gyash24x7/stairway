import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { StairwayAPI } from "@/api.ts";
import { coup } from "@/games/coup/server/engine.ts";
import { makeApiHandlers, SwishDurableObject } from "@/swish/server/api.ts";

import type {
	CoupConfig,
	CoupMoves,
	CoupView
} from "@/games/coup/shared/schema.ts";


// --- Durable Object ----------------------------------------------------------

export class CoupGame extends Cloudflare.DurableObject<CoupGame>()(
	"CoupGame",
	SwishDurableObject( coup )
) {}


// --- HTTP Api implementation -------------------------------------------------

export const CoupApiLive = HttpApiBuilder.group( StairwayAPI, "coup", handlers =>
	Effect.gen( function* () {
		const ns = yield* CoupGame;
		const api = yield* makeApiHandlers<CoupView, CoupMoves, CoupConfig>(
			"coup",
			[ "takeAction", "challenge", "block", "surrenderInfluence", "exchangeCards" ],
			gameId => ns.getByName( gameId )
		);

		return handlers
			.handle( "createGame", ( { payload } ) => api.createGame( payload ) )
			.handle( "join", ( { payload } ) => api.joinGame( payload ) )
			.handle( "getView", ( { params } ) => api.getView( params ) )
			.handle( "addBots", ( { params } ) => api.addBots( params ) )
			.handle( "start", ( { params } ) => api.startGame( params ) )
			.handle( "setAutoPlay", ( { params, payload } ) => api.autoPlay( params, payload ) )
			.handle( "rematch", ( { params, payload } ) => api.rematch( params, payload ) )
			.handle( "takeAction", ( { params, payload } ) => api.takeAction( params, payload ) )
			.handle( "challenge", ( { params, payload } ) => api.challenge( params, payload ) )
			.handle( "block", ( { params, payload } ) => api.block( params, payload ) )
			.handle(
				"surrenderInfluence",
				( { params, payload } ) => api.surrenderInfluence( params, payload )
			)
			.handle( "exchangeCards", ( { params, payload } ) => api.exchangeCards( params, payload ) )
			.handle( "undo", ( { params } ) => api.undo( params ) )
			.handle( "redo", ( { params } ) => api.redo( params ) );
	} )
);
