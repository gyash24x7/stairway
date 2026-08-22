import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { StairwayAPI } from "@/api.ts";
import { tictactoe } from "@/games/tictactoe/server/engine.ts";
import {
	TICTACTOE_MOVE_TIMEOUT_MILLIS,
	TICTACTOE_PLAYER_COUNT,
	TicTacToeConfig
} from "@/games/tictactoe/shared/schema.ts";
import { makeGameApi, SwishDurableObject } from "@/swish/server/api.ts";


// --- Durable Object ----------------------------------------------------------

export class TicTacToeGame extends Cloudflare.DurableObject<TicTacToeGame>()(
	"TicTacToeGame",
	SwishDurableObject( "tictactoe", tictactoe )
) {}


// --- HTTP Api implementation -------------------------------------------------

export const TicTacToeApiLive = HttpApiBuilder.group( StairwayAPI, "tictactoe", handlers =>
	Effect.gen( function* () {
		const api = yield* makeGameApi( { game: "tictactoe", ns: yield* TicTacToeGame } );

		return handlers
			.handle( "createGame", api.createGame( client => client.initialize, () => Effect.succeed(
				TicTacToeConfig.make( {
					playerCount: TICTACTOE_PLAYER_COUNT,
					autoStart: false,
					moveTimeoutMillis: TICTACTOE_MOVE_TIMEOUT_MILLIS
				} )
			) ) )
			.handle( "join", api.join )
			.handle( "getView", api.getView( client => client.getState ) )
			.handle( "addBots", api.addBots )
			.handle( "start", api.start )
			.handle( "place", api.move( client => client.place ) )
			.handle( "setAutoPlay", api.setAutoPlay )
			.handle( "undo", api.undo )
			.handle( "redo", api.redo );
	} )
);
