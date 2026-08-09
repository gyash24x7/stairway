import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { StairwayAPI } from "@/api.ts";
import { AuthContext } from "@/auth/shared/middleware.ts";
import { toPlayerInfo } from "@/client.ts";
import {
	WORDLE_PLAYER_COUNT,
	WordleConfig,
	WordleInitializeInput
} from "@/games/wordle/shared/schema.ts";
import { channels, games } from "@/platform/database/schema.ts";
import { Database } from "@/platform/database/service.ts";
import { DurableSchedulerLive } from "@/platform/do/scheduler.ts";
import { DurableEventStoreLive, DurableGameStoreLive } from "@/platform/do/stores.ts";
import { DurableSyncLive, GameChannel } from "@/platform/do/sync.ts";
import { GameArchiveLive } from "@/platform/kv/archive.ts";
import { ArchiveKV } from "@/platform/kv/archive.ts";
import { GameCode, GameId, PlayerId, PlayerInfo } from "@/shared/swish/schema.ts";
import { wordle } from "@/games/wordle/server/engine.ts";

// --- Durable Object ----------------------------------------------------------

export class WordleEngineDO extends Cloudflare.DurableObject<WordleEngineDO>()(
	"WordleEngineDO",
	Effect.gen( function* () {
		const channels = yield* GameChannel;
		const state = yield* Cloudflare.DurableObjectState;
		const kv = yield* Cloudflare.KV.ReadWriteNamespace( ArchiveKV );
		return wordle.pipe(
			Effect.provide(
				Layer.mergeAll(
					DurableGameStoreLive( state ),
					DurableEventStoreLive( state ),
					DurableSyncLive( channels ),
					DurableSchedulerLive( state ),
					GameArchiveLive( kv )
				)
			)
		);
	} ).pipe( Effect.provide( Cloudflare.KV.ReadWriteNamespaceBinding ) )
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

				yield* db.insert( channels ).values( {
					id: game.id,
					refType: "game",
					refId: game.id,
					label: "wordle",
					policy: { text: true, reactions: true }
				} ).pipe( Effect.orDie );

				// The puzzle shape comes from the client; the single seat and
				// `autoStart` are fixed server-side.
				const input = WordleInitializeInput.make( {
					id: GameId.make( game.id ),
					code: GameCode.make( game.code ),
					config: WordleConfig.make( {
						...payload,
						playerCount: WORDLE_PLAYER_COUNT,
						autoStart: true
					} )
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
