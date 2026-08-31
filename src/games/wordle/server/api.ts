import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { StairwayAPI } from "@/api.ts";
import { wordle } from "@/games/wordle/server/engine.ts";
import { makeApiHandlers, SwishDurableObject } from "@/swish/server/api.ts";

import type { WordleConfig, WordleMoves, WordleView } from "@/games/wordle/shared/schema.ts";


// --- Durable Object ----------------------------------------------------------

export class WordleGame extends Cloudflare.DurableObject<WordleGame>()(
	"WordleGame",
	SwishDurableObject( wordle )
) {}


// --- HTTP Api implementation -------------------------------------------------

export const WordleApiLive = HttpApiBuilder.group( StairwayAPI, "wordle", handlers =>
	Effect.gen( function* () {
		const ns = yield* WordleGame;
		const api = yield* makeApiHandlers<WordleView, WordleMoves, WordleConfig>(
			"wordle",
			[ "guess", "forfeit" ],
			gameId => ns.getByName( gameId )
		);

		return handlers
			.handle( "createGame", () => api.createGame() )
			.handle( "join", ( { payload } ) => api.joinGame( payload ) )
			.handle( "getView", ( { params } ) => api.getView( params ) )
			.handle( "addBots", ( { params } ) => api.addBots( params ) )
			.handle( "guess", ( { params, payload } ) => api.guess( params, payload ) )
			.handle( "forfeit", ( { params, payload } ) => api.forfeit( params, payload ) )
			.handle( "setAutoPlay", ( { params, payload } ) => api.autoPlay( params, payload ) )
			.handle( "rematch", ( { params, payload } ) => api.rematch( params, payload ) );
	} )
);
