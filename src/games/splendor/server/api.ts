import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { StairwayAPI } from "@/api.ts";
import { splendor } from "@/games/splendor/server/engine.ts";
import {
	SPLENDOR_DEFAULT_WINNING_POINTS,
	SPLENDOR_MOVE_TIMEOUT_MILLIS,
	SplendorConfig
} from "@/games/splendor/shared/schema.ts";
import { makeGameApi, SwishDurableObject } from "@/swish/server/api.ts";

import type { SplendorCreateInput } from "@/games/splendor/shared/schema.ts";


// --- Durable Object ----------------------------------------------------------

export class SplendorGame extends Cloudflare.DurableObject<SplendorGame>()(
	"SplendorGame",
	SwishDurableObject( splendor )
) {}


// --- HTTP Api implementation -------------------------------------------------

export const SplendorApiLive = HttpApiBuilder.group( StairwayAPI, "splendor", handlers =>
	Effect.gen( function* () {
		const api = yield* makeGameApi( { game: "splendor", ns: yield* SplendorGame } );

		return handlers
			.handle( "createGame", api.createGame(
				client => client.initialize,
				( payload: SplendorCreateInput ) => Effect.succeed( SplendorConfig.make( {
					playerCount: payload.playerCount,
					winningPoints: payload.winningPoints ?? SPLENDOR_DEFAULT_WINNING_POINTS,
					autoStart: false,
					moveTimeoutMillis: SPLENDOR_MOVE_TIMEOUT_MILLIS
				} ) )
			) )
			.handle( "join", api.join )
			.handle( "getView", api.getView( client => client.getState ) )
			.handle( "addBots", api.addBots )
			.handle( "start", api.start )
			.handle( "pickTokens", api.move( client => client.pickTokens ) )
			.handle( "reserveCard", api.move( client => client.reserveCard ) )
			.handle( "purchaseCard", api.move( client => client.purchaseCard ) )
			.handle( "pass", api.move( client => client.pass ) )
			.handle( "claimNoble", api.move( client => client.claimNoble ) )
			.handle( "setAutoPlay", api.setAutoPlay )
			.handle( "rematch", api.rematch(
				client => client.initialize,
				client => client.getState
			) )
			.handle( "undo", api.undo )
			.handle( "redo", api.redo );
	} )
);
