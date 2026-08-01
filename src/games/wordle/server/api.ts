import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { StairwayAPI } from "@/api.ts";
import { AuthContext } from "@/auth/shared/middleware.ts";
import { toPlayerInfo } from "@/client.ts";
import { WordleInitializeInput } from "@/games/wordle/shared/schema.ts";
import { games } from "@/platform/database/schema.ts";
import { Database } from "@/platform/database/service.ts";
import { DurableSchedulerLive } from "@/platform/do/scheduler.ts";
import { DurableEventStoreLive, DurableGameStoreLive } from "@/platform/do/stores.ts";
import { DurableSyncLive, GameChannel } from "@/platform/do/sync.ts";
import { GameCode, GameId, PlayerId, PlayerInfo } from "@/shared/swish/schema.ts";
import { wordle } from "@/games/wordle/server/engine.ts";

// --- Durable Object ----------------------------------------------------------

export class WordleEngineDO extends Cloudflare.DurableObject<WordleEngineDO>()(
	"WordleEngineDO",
	Effect.gen( function* () {
		const channels = yield* GameChannel;
		const state = yield* Cloudflare.DurableObjectState;
		return wordle.pipe(
			Effect.provide(
				Layer.mergeAll(
					DurableGameStoreLive( state ),
					DurableEventStoreLive( state ),
					DurableSyncLive( channels ),
					DurableSchedulerLive( state )
				)
			)
		);
	} )
) {}

// --- HTTP Api implementation -------------------------------------------------

export const WordleApiLive = HttpApiBuilder.group( StairwayAPI, "wordle", handlers =>
	Effect.gen( function* () {
		const db = yield* Database;
		const ns = yield* WordleEngineDO;
		return handlers
			.handle( "createGame", ( { payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const game = yield* db.insert( games ).values( { game: "wordle" } ).returning()
					.pipe( Effect.map( v => v[ 0 ] ), Effect.orDie );

				const input = WordleInitializeInput.make( {
					id: GameId.make( game.id ),
					code: GameCode.make( game.code ),
					config: payload
				} );

				const client = ns.getByName( game.id );
				const response = yield* client.initialize( input );
				yield* client.join(
					PlayerInfo.make( {
						id: PlayerId.make( user.id ),
						name: user.name,
						avatar: user.avatar
					} )
				);

				return response;
			} ) )

			.handle( "getState", ( { params } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const client = ns.getByName( params.gameId );
				return yield* client.getState( PlayerId.make( user.id ) );
			} ) )

			.handle( "guess", ( { params, payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const client = ns.getByName( params.gameId );
				return yield* client.guess( payload, toPlayerInfo( user ) );
			} ) );
	} )
);
