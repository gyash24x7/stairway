import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { StairwayAPI } from "@/api.ts";
import { AuthContext } from "@/auth/shared/middleware.ts";
import { toPlayerInfo } from "@/client.ts";
import { KingdominoInitializeInput } from "@/games/kingdomino/shared/schema.ts";
import { games } from "@/platform/database/schema.ts";
import { Database } from "@/platform/database/service.ts";
import { DurableSchedulerLive } from "@/platform/do/scheduler.ts";
import { DurableEventStoreLive, DurableGameStoreLive } from "@/platform/do/stores.ts";
import { DurableSyncLive, GameChannel } from "@/platform/do/sync.ts";
import { GameArchiveLive } from "@/platform/kv/archive.ts";
import { ArchiveKV } from "@/platform/kv/archive.ts";
import { GameNotFound } from "@/shared/swish/errors.ts";
import { GameCode, GameId, PlayerId } from "@/shared/swish/schema.ts";
import { kingdomino } from "@/games/kingdomino/server/engine.ts";

// --- Durable Object ----------------------------------------------------------

export class KingdominoEngineDO extends Cloudflare.DurableObject<KingdominoEngineDO>()(
	"KingdominoEngineDO",
	Effect.gen( function* () {
		const channels = yield* GameChannel;
		const state = yield* Cloudflare.DurableObjectState;
		const kv = yield* Cloudflare.KV.ReadWriteNamespace( ArchiveKV );
		return kingdomino.pipe(
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

export const KingdominoApiLive = HttpApiBuilder.group( StairwayAPI, "kingdomino", handlers =>
	Effect.gen( function* () {
		const db = yield* Database;
		const ns = yield* KingdominoEngineDO;
		return handlers
			.handle( "createGame", ( { payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const game = yield* db.insert( games ).values( { game: "kingdomino" } ).returning()
					.pipe( Effect.map( v => v[ 0 ] ), Effect.orDie );

				const input = KingdominoInitializeInput.make( {
					id: GameId.make( game.id ),
					code: GameCode.make( game.code ),
					config: payload
				} );

				const client = ns.getByName( game.id );
				const response = yield* client.initialize( input );
				yield* client.join( toPlayerInfo( user ) );

				return response;
			} ) )

			.handle( "join", ( { payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const game = yield* db.query.games
					.findFirst( { where: { game: "kingdomino", code: payload.code } } )
					.pipe( Effect.orDie );

				if ( !game ) {
					return yield* new GameNotFound( { code: payload.code } );
				}

				const client = ns.getByName( game.id );
				return yield* client.join( toPlayerInfo( user ) );
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

			.handle( "selectDomino", ( { params, payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const client = ns.getByName( params.gameId );
				return yield* client.selectDomino( payload, toPlayerInfo( user ) );
			} ) )

			.handle( "placeDomino", ( { params, payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const client = ns.getByName( params.gameId );
				return yield* client.placeDomino( payload, toPlayerInfo( user ) );
			} ) )

			.handle( "discardDomino", ( { params, payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const client = ns.getByName( params.gameId );
				return yield* client.discardDomino( payload, toPlayerInfo( user ) );
			} ) );
	} )
);
