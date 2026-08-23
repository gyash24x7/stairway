import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { StairwayAPI } from "@/api.ts";
import { wordle } from "@/games/wordle/server/engine.ts";
import { WORDLE_MOVE_TIMEOUT_MILLIS, WordleConfig } from "@/games/wordle/shared/schema.ts";
import { makeGameApi, SwishDurableObject } from "@/swish/server/api.ts";

import type { WordleCreateInput } from "@/games/wordle/shared/schema.ts";


// --- Durable Object ----------------------------------------------------------

export class WordleGame extends Cloudflare.DurableObject<WordleGame>()(
	"WordleGame",
	SwishDurableObject( "wordle", wordle )
) {}


// --- HTTP Api implementation -------------------------------------------------

export const WordleApiLive = HttpApiBuilder.group( StairwayAPI, "wordle", handlers =>
	Effect.gen( function* () {
		const api = yield* makeGameApi( { game: "wordle", ns: yield* WordleGame } );

		return handlers
			.handle( "createGame", api.createGame(
				client => client.initialize,
				( payload: WordleCreateInput ) =>
					Effect.succeed( WordleConfig.make( {
						...payload,
						autoStart: true,
						moveTimeoutMillis: WORDLE_MOVE_TIMEOUT_MILLIS
					} ) )
			) )
			.handle( "join", api.join )
			.handle( "getView", api.getView( client => client.getState ) )
			.handle( "addBots", api.addBots )
			.handle( "guess", api.move( client => client.guess ) )
			.handle( "forfeit", api.move( client => client.forfeit ) )
			.handle( "setAutoPlay", api.setAutoPlay )
			.handle( "rematch", api.rematch(
				client => client.initialize,
				client => client.getState
			) );
	} )
);
