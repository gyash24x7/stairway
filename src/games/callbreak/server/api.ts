import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { StairwayAPI } from "@/api.ts";
import { callbreak } from "@/games/callbreak/server/engine.ts";
import {
	CALLBREAK_MOVE_TIMEOUT_MILLIS,
	CALLBREAK_PLAYER_COUNT,
	CallbreakConfig
} from "@/games/callbreak/shared/schema.ts";
import { makeGameApi, SwishDurableObject } from "@/swish/server/api.ts";

import type { CallbreakCreateInput } from "@/games/callbreak/shared/schema.ts";


// --- Durable Object ----------------------------------------------------------

export class CallbreakGame extends Cloudflare.DurableObject<CallbreakGame>()(
	"CallbreakGame",
	SwishDurableObject( "callbreak", callbreak )
) {}


// --- HTTP Api implementation -------------------------------------------------

export const CallbreakApiLive = HttpApiBuilder.group( StairwayAPI, "callbreak", handlers =>
	Effect.gen( function* () {
		const api = yield* makeGameApi( { game: "callbreak", ns: yield* CallbreakGame } );

		return handlers
			.handle( "createGame", api.createGame(
				client => client.initialize,
				( payload: CallbreakCreateInput ) => Effect.succeed( CallbreakConfig.make( {
					playerCount: CALLBREAK_PLAYER_COUNT,
					dealCount: payload.dealCount,
					trumpSuit: payload.trumpSuit,
					autoStart: false,
					moveTimeoutMillis: CALLBREAK_MOVE_TIMEOUT_MILLIS
				} ) )
			) )
			.handle( "join", api.join )
			.handle( "getView", api.getView( client => client.getState ) )
			.handle( "addBots", api.addBots )
			.handle( "start", api.start )
			.handle( "declareWins", api.move( client => client.declareWins ) )
			.handle( "playCard", api.move( client => client.playCard ) )
			.handle( "setAutoPlay", api.setAutoPlay )
			.handle( "undo", api.undo )
			.handle( "redo", api.redo );
	} )
);
