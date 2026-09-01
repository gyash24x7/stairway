import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { StairwayAPI } from "@/api.ts";
import { tictactoe } from "@/games/tictactoe/server/engine.ts";
import { makeApiHandlers, SwishDurableObject } from "@/swish/server/api.ts";

import type {
	PlaceInput,
	TicTacToeConfig,
	TicTacToeView
} from "@/games/tictactoe/shared/schema.ts";


// --- Durable Object ----------------------------------------------------------

export class TicTacToeGame extends Cloudflare.DurableObject<TicTacToeGame>()(
	"TicTacToeGame",
	SwishDurableObject( tictactoe )
) {}


// --- HTTP Api implementation -------------------------------------------------

export const TicTacToeApiLive = HttpApiBuilder.group( StairwayAPI, "tictactoe", handlers =>
	Effect.gen( function* () {
		const ns = yield* TicTacToeGame;
		const api = yield* makeApiHandlers<TicTacToeView, { place: PlaceInput }, TicTacToeConfig>(
			"tictactoe",
			[ "place" ],
			gameId => ns.getByName( gameId )
		);

		return handlers
			.handle( "createGame", ( { payload } ) => api.createGame( payload ) )
			.handle( "join", ( { payload } ) => api.joinGame( payload ) )
			.handle( "getView", ( { params } ) => api.getView( params ) )
			.handle( "addBots", ( { params } ) => api.addBots( params ) )
			.handle( "start", ( { params } ) => api.startGame( params ) )
			.handle( "place", ( { params, payload } ) => api.place( params, payload ) )
			.handle( "setAutoPlay", ( { params, payload } ) => api.autoPlay( params, payload ) )
			.handle( "rematch", ( { params, payload } ) => api.rematch( params, payload ) )
			.handle( "undo", ( { params } ) => api.undo( params ) )
			.handle( "redo", ( { params } ) => api.redo( params ) );
	} )
);
