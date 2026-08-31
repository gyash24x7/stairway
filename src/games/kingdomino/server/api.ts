import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { StairwayAPI } from "@/api.ts";
import { kingdomino } from "@/games/kingdomino/server/engine.ts";
import { makeApiHandlers, SwishDurableObject } from "@/swish/server/api.ts";

import type {
	KingdominoConfig,
	KingdominoMoves,
	KingdominoView
} from "@/games/kingdomino/shared/schema.ts";


// --- Durable Object ----------------------------------------------------------

export class KingdominoGame extends Cloudflare.DurableObject<KingdominoGame>()(
	"KingdominoGame",
	SwishDurableObject( kingdomino )
) {}


// --- HTTP Api implementation -------------------------------------------------

export const KingdominoApiLive = HttpApiBuilder.group( StairwayAPI, "kingdomino", handlers =>
	Effect.gen( function* () {
		const ns = yield* KingdominoGame;
		const api = yield* makeApiHandlers<KingdominoView, KingdominoMoves, KingdominoConfig>(
			"kingdomino",
			[ "selectDomino", "placeDomino", "discardDomino" ],
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
			.handle( "selectDomino", ( { params, payload } ) => api.selectDomino( params, payload ) )
			.handle( "placeDomino", ( { params, payload } ) => api.placeDomino( params, payload ) )
			.handle( "discardDomino", ( { params, payload } ) => api.discardDomino( params, payload ) )
			.handle( "undo", ( { params } ) => api.undo( params ) )
			.handle( "redo", ( { params } ) => api.redo( params ) );
	} )
);
