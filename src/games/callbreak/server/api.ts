import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { StairwayAPI } from "@/api.ts";
import { AuthContext } from "@/auth/shared/middleware.ts";
import { toPlayerInfo } from "@/client.ts";
import {
	CALLBREAK_PLAYER_COUNT,
	CallbreakConfig,
	CallbreakInitializeInput
} from "@/games/callbreak/shared/schema.ts";
import { games } from "@/platform/database/schema.ts";
import { Database } from "@/platform/database/service.ts";
import { DurableSchedulerLive } from "@/platform/do/scheduler.ts";
import { DurableEventStoreLive, DurableGameStoreLive } from "@/platform/do/stores.ts";
import { DurableSyncLive, GameChannel } from "@/platform/do/sync.ts";
import { GameArchiveLive } from "@/platform/kv/archive.ts";
import { ArchiveKV } from "@/platform/kv/archive.ts";
import { GameNotFound } from "@/shared/swish/errors.ts";
import { GameCode, GameId, PlayerId } from "@/shared/swish/schema.ts";
import { callbreak } from "@/games/callbreak/server/engine.ts";

// --- Durable Object ----------------------------------------------------------

export class CallbreakEngineDO extends Cloudflare.DurableObject<CallbreakEngineDO>()(
	"CallbreakEngineDO",
	Effect.gen( function* () {
		const channels = yield* GameChannel;
		const state = yield* Cloudflare.DurableObjectState;
		const kv = yield* Cloudflare.KV.ReadWriteNamespace( ArchiveKV );
		return callbreak.pipe(
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

export const CallbreakApiLive = HttpApiBuilder.group( StairwayAPI, "callbreak", handlers =>
	Effect.gen( function* () {
		const db = yield* Database;
		const ns = yield* CallbreakEngineDO;
		return handlers
			.handle( "createGame", ( { payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const game = yield* db.insert( games ).values( { game: "callbreak" } ).returning()
					.pipe( Effect.map( v => v[ 0 ] ), Effect.orDie );

				// The round shape comes from the client; the four seats and
				// `autoStart` are fixed server-side.
				const input = CallbreakInitializeInput.make( {
					id: GameId.make( game.id ),
					code: GameCode.make( game.code ),
					config: CallbreakConfig.make( {
						...payload,
						playerCount: CALLBREAK_PLAYER_COUNT,
						autoStart: true
					} )
				} );

				const client = ns.getByName( game.id );
				const response = yield* client.initialize( input );
				yield* client.join( toPlayerInfo( user ) );

				return response;
			} ) )

			.handle( "join", ( { payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const game = yield* db.query.games
					.findFirst( { where: { game: "callbreak", code: payload.code } } )
					.pipe( Effect.orDie );

				if ( !game ) {
					return yield* new GameNotFound( { code: payload.code } );
				}

				const client = ns.getByName( game.id );
				return yield* client.join( toPlayerInfo( user ) );
			} ) )

			.handle( "addBots", ( { params } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const client = ns.getByName( params.gameId );
				return yield* client.addBots( PlayerId.make( user.id ) );
			} ) )

			.handle( "start", ( { params } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const client = ns.getByName( params.gameId );
				return yield* client.start( PlayerId.make( user.id ) );
			} ) )

			.handle( "getState", ( { params } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const client = ns.getByName( params.gameId );
				return yield* client.getState( PlayerId.make( user.id ) );
			} ) )

			.handle( "declareWins", ( { params, payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const client = ns.getByName( params.gameId );
				return yield* client.declareWins( payload, toPlayerInfo( user ) );
			} ) )

			.handle( "playCard", ( { params, payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const client = ns.getByName( params.gameId );
				return yield* client.playCard( payload, toPlayerInfo( user ) );
			} ) );
	} )
);
