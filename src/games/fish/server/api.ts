import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { StairwayAPI } from "@/api.ts";
import { AuthContext } from "@/auth/shared/middleware.ts";
import { toPlayerInfo } from "@/client.ts";
import { FishInitializeInput } from "@/games/fish/shared/schema.ts";
import { games } from "@/platform/database/schema.ts";
import { Database } from "@/platform/database/service.ts";
import { DurableSchedulerLive } from "@/platform/do/scheduler.ts";
import { DurableEventStoreLive, DurableGameStoreLive } from "@/platform/do/stores.ts";
import { DurableSyncLive, GameChannel } from "@/platform/do/sync.ts";
import { archiveNamespace, GameArchiveLive } from "@/platform/kv/archive.ts";
import { GameNotFound } from "@/shared/swish/errors.ts";
import { GameCode, GameId, PlayerId } from "@/shared/swish/schema.ts";
import { fish } from "@/games/fish/server/engine.ts";

// --- Durable Object ----------------------------------------------------------

export class FishEngineDO extends Cloudflare.DurableObject<FishEngineDO>()(
	"FishEngineDO",
	Effect.gen( function* () {
		const channels = yield* GameChannel;
		const state = yield* Cloudflare.DurableObjectState;
		const archiveKv = yield* archiveNamespace;
		return fish.pipe(
			Effect.provide(
				Layer.mergeAll(
					DurableGameStoreLive( state ),
					DurableEventStoreLive( state ),
					DurableSyncLive( channels ),
					DurableSchedulerLive( state ),
					GameArchiveLive( archiveKv )
				)
			)
		);
	} )
) {}

// --- HTTP Api implementation -------------------------------------------------

export const FishApiLive = HttpApiBuilder.group( StairwayAPI, "fish", handlers =>
	Effect.gen( function* () {
		const db = yield* Database;
		const ns = yield* FishEngineDO;
		return handlers
			.handle( "createGame", ( { payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const game = yield* db.insert( games ).values( { game: "fish" } ).returning()
					.pipe( Effect.map( v => v[ 0 ] ), Effect.orDie );

				const input = FishInitializeInput.make( {
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
					.findFirst( { where: { game: "fish", code: payload.code } } )
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

			.handle( "createTeams", ( { params, payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const client = ns.getByName( params.gameId );
				return yield* client.createTeams( payload, toPlayerInfo( user ) );
			} ) )

			.handle( "askCard", ( { params, payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const client = ns.getByName( params.gameId );
				return yield* client.askCard( payload, toPlayerInfo( user ) );
			} ) )

			.handle( "claimBook", ( { params, payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const client = ns.getByName( params.gameId );
				return yield* client.claimBook( payload, toPlayerInfo( user ) );
			} ) )

			.handle( "transferTurn", ( { params, payload } ) => Effect.gen( function* () {
				const { user } = yield* AuthContext;
				const client = ns.getByName( params.gameId );
				return yield* client.transferTurn( payload, toPlayerInfo( user ) );
			} ) );
	} )
);
