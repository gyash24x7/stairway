import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { StairwayAPI } from "@/api.ts";
import { fish } from "@/games/fish/server/engine.ts";
import { makeApiHandlers, SwishDurableObject } from "@/swish/server/api.ts";

import type { FishConfig, FishMoves, FishView } from "@/games/fish/shared/schema.ts";


// --- Durable Object ----------------------------------------------------------

export class FishGame extends Cloudflare.DurableObject<FishGame>()(
	"FishGame",
	SwishDurableObject( fish )
) {}


// --- HTTP Api implementation -------------------------------------------------

export const FishApiLive = HttpApiBuilder.group( StairwayAPI, "fish", handlers =>
	Effect.gen( function* () {
		const ns = yield* FishGame;
		const api = yield* makeApiHandlers<FishView, FishMoves, FishConfig>(
			"fish",
			[ "askCard", "claimBook", "transferTurn" ],
			gameId => ns.getByName( gameId )
		);

		return handlers
			.handle( "createGame", ( { payload } ) => api.createGame( payload ) )
			.handle( "join", ( { payload } ) => api.joinGame( payload ) )
			.handle( "getView", ( { params } ) => api.getView( params ) )
			.handle( "addBots", ( { params } ) => api.addBots( params ) )
			.handle( "joinTeam", ( { params, payload } ) => api.joinTeam( params, payload ) )
			.handle( "nameTeam", ( { params, payload } ) => api.nameTeam( params, payload ) )
			.handle( "leaveTeam", ( { params } ) => api.leaveTeam( params ) )
			.handle( "start", ( { params } ) => api.startGame( params ) )
			.handle( "setAutoPlay", ( { params, payload } ) => api.autoPlay( params, payload ) )
			.handle( "rematch", ( { params, payload } ) => api.rematch( params, payload ) )
			.handle( "askCard", ( { params, payload } ) => api.askCard( params, payload ) )
			.handle( "claimBook", ( { params, payload } ) => api.claimBook( params, payload ) )
			.handle( "transferTurn", ( { params, payload } ) => api.transferTurn( params, payload ) )
			.handle( "undo", ( { params } ) => api.undo( params ) )
			.handle( "redo", ( { params } ) => api.redo( params ) );
	} )
);
