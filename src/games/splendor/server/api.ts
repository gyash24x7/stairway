import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { StairwayAPI } from "@/api.ts";
import { splendor } from "@/games/splendor/server/engine.ts";
import { makeApiHandlers, SwishDurableObject } from "@/swish/server/api.ts";

import type {
	SplendorConfig,
	SplendorMoves,
	SplendorView
} from "@/games/splendor/shared/schema.ts";


// --- Durable Object ----------------------------------------------------------

export class SplendorGame extends Cloudflare.DurableObject<SplendorGame>()(
	"SplendorGame",
	SwishDurableObject( splendor )
) {}


// --- HTTP Api implementation -------------------------------------------------

export const SplendorApiLive = HttpApiBuilder.group( StairwayAPI, "splendor", handlers =>
	Effect.gen( function* () {
		const ns = yield* SplendorGame;
		const api = yield* makeApiHandlers<SplendorView, SplendorMoves, SplendorConfig>(
			"splendor",
			[ "pickTokens", "reserveCard", "purchaseCard", "pass", "claimNoble" ],
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
			.handle( "pickTokens", ( { params, payload } ) => api.pickTokens( params, payload ) )
			.handle( "reserveCard", ( { params, payload } ) => api.reserveCard( params, payload ) )
			.handle( "purchaseCard", ( { params, payload } ) => api.purchaseCard( params, payload ) )
			.handle( "pass", ( { params, payload } ) => api.pass( params, payload ) )
			.handle( "claimNoble", ( { params, payload } ) => api.claimNoble( params, payload ) )
			.handle( "undo", ( { params } ) => api.undo( params ) )
			.handle( "redo", ( { params } ) => api.redo( params ) );
	} )
);
