import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { StairwayAPI } from "@/api.ts";
import { kingdomino } from "@/games/kingdomino/server/engine.ts";
import {
	KINGDOMINO_DEFAULT_BOARD_SIZE,
	KINGDOMINO_MOVE_TIMEOUT_MILLIS,
	KingdominoConfig
} from "@/games/kingdomino/shared/schema.ts";
import { makeGameApi, SwishDurableObject } from "@/swish/server/api.ts";

import type { KingdominoCreateInput } from "@/games/kingdomino/shared/schema.ts";


// --- Durable Object ----------------------------------------------------------

export class KingdominoGame extends Cloudflare.DurableObject<KingdominoGame>()(
	"KingdominoGame",
	SwishDurableObject( kingdomino )
) {}


// --- HTTP Api implementation -------------------------------------------------

export const KingdominoApiLive = HttpApiBuilder.group( StairwayAPI, "kingdomino", handlers =>
	Effect.gen( function* () {
		const api = yield* makeGameApi( { game: "kingdomino", ns: yield* KingdominoGame } );

		return handlers
			.handle( "createGame", api.createGame(
				client => client.initialize,
				( payload: KingdominoCreateInput ) => Effect.succeed( KingdominoConfig.make( {
					playerCount: payload.playerCount,
					boardSize: payload.boardSize ?? KINGDOMINO_DEFAULT_BOARD_SIZE,
					autoStart: false,
					moveTimeoutMillis: KINGDOMINO_MOVE_TIMEOUT_MILLIS
				} ) )
			) )
			.handle( "join", api.join )
			.handle( "getView", api.getView( client => client.getState ) )
			.handle( "addBots", api.addBots )
			.handle( "start", api.start )
			.handle( "selectDomino", api.move( client => client.selectDomino ) )
			.handle( "placeDomino", api.move( client => client.placeDomino ) )
			.handle( "discardDomino", api.move( client => client.discardDomino ) )
			.handle( "setAutoPlay", api.setAutoPlay )
			.handle( "undo", api.undo )
			.handle( "redo", api.redo );
	} )
);
