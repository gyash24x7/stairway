import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { StairwayAPI } from "@/api.ts";
import { callbreak } from "@/games/callbreak/server/engine.ts";
import { makeApiHandlers, SwishDurableObject } from "@/swish/server/api.ts";

import type {
	CallbreakConfig,
	CallbreakMoves,
	CallbreakView
} from "@/games/callbreak/shared/schema.ts";


// --- Durable Object ----------------------------------------------------------

export class CallbreakGame extends Cloudflare.DurableObject<CallbreakGame>()(
	"CallbreakGame",
	SwishDurableObject( callbreak )
) {}


// --- HTTP Api implementation -------------------------------------------------

export const CallbreakApiLive = HttpApiBuilder.group( StairwayAPI, "callbreak", handlers =>
	Effect.gen( function* () {
		const ns = yield* CallbreakGame;
		const api = yield* makeApiHandlers<CallbreakView, CallbreakMoves, CallbreakConfig>(
			"callbreak",
			[ "declareWins", "playCard" ],
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
			.handle( "declareWins", ( { params, payload } ) => api.declareWins( params, payload ) )
			.handle( "playCard", ( { params, payload } ) => api.playCard( params, payload ) )
			.handle( "undo", ( { params } ) => api.undo( params ) )
			.handle( "redo", ( { params } ) => api.redo( params ) );
	} )
);
