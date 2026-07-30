import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { StairwayAPI } from "@/api.ts";
import { AuthContext } from "@/auth/shared/middleware.ts";
import { toPlayerInfo } from "@/client.ts";
import { SplendorInitializeInput } from "@/games/splendor/shared/schema.ts";
import { games } from "@/platform/database/schema.ts";
import { Database, ops } from "@/platform/database/service.ts";
import { DurableSchedulerLive } from "@/platform/do/scheduler.ts";
import { DurableEventStoreLive, DurableGameStoreLive } from "@/platform/do/stores.ts";
import { DurableSyncLive, GameChannel } from "@/platform/do/sync.ts";
import { GameNotFound } from "@/shared/swish/errors.ts";
import { GameCode, GameId } from "@/shared/swish/schema.ts";
import { splendor } from "@/games/splendor/server/engine.ts";

// --- Durable Object ----------------------------------------------------------

export class SplendorEngineDO extends Cloudflare.DurableObject<SplendorEngineDO>()(
	"SplendorEngineDO",
	Effect.gen( function* () {
		const channels = yield* GameChannel;
		const state = yield* Cloudflare.DurableObjectState;
		return splendor.pipe(
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

export const SplendorApiLive = ( ns: Cloudflare.DurableObject<SplendorEngineDO> ) =>
	HttpApiBuilder.group( StairwayAPI, "splendor", handlers =>
		Effect.gen( function* () {
			const db = yield* Database;
			return handlers
				.handle( "createGame", ( { payload } ) => Effect.gen( function* () {
					const { user } = yield* AuthContext;
					const game = yield* Effect.promise(
						() => db.insert( games )
							.values( { game: "splendor" } )
							.returning()
							.then( g => g[ 0 ] )
					);

					const input = SplendorInitializeInput.make( {
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
					const game = yield* Effect.promise(
						() => db.select().from( games )
							.where( ops.and(
								ops.eq( games.game, "splendor" ),
								ops.eq( games.code, payload.code )
							) )
							.then( g => g[ 0 ] )
					);

					if ( !game ) {
						return yield* new GameNotFound( { code: payload.code } );
					}

					const client = ns.getByName( game.id );
					return yield* client.join( toPlayerInfo( user ) );
				} ) )

				.handle( "addBots", ( { params } ) => Effect.gen( function* () {
					const client = ns.getByName( params.gameId );
					return yield* client.addBots();
				} ) )

				.handle( "getState", ( { params, payload } ) => Effect.gen( function* () {
					const client = ns.getByName( params.gameId );
					return yield* client.getState( payload );
				} ) )

				.handle( "pickTokens", ( { params, payload } ) => Effect.gen( function* () {
					const { user } = yield* AuthContext;
					const client = ns.getByName( params.gameId );
					return yield* client.pickTokens( payload, toPlayerInfo( user ) );
				} ) )

				.handle( "reserveCard", ( { params, payload } ) => Effect.gen( function* () {
					const { user } = yield* AuthContext;
					const client = ns.getByName( params.gameId );
					return yield* client.reserveCard( payload, toPlayerInfo( user ) );
				} ) )

				.handle( "purchaseCard", ( { params, payload } ) => Effect.gen( function* () {
					const { user } = yield* AuthContext;
					const client = ns.getByName( params.gameId );
					return yield* client.purchaseCard( payload, toPlayerInfo( user ) );
				} ) );
		} )
	);
