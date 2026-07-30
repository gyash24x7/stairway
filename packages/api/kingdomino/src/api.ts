import { StairwayAPI } from "@s2h/contract/api";
import { toPlayerInfo } from "@s2h/contract/client";
import { AuthContext } from "@s2h/contract/middleware";
import { games } from "@s2h/platform/database/schema";
import { Database, ops } from "@s2h/platform/database/service";
import { DurableSchedulerLive } from "@s2h/platform/do/scheduler";
import { DurableEventStoreLive, DurableGameStoreLive } from "@s2h/platform/do/stores";
import { DurableSyncLive, GameChannel } from "@s2h/platform/do/sync";
import { KingdominoInitializeInput } from "@s2h/schema/kingdomino";
import { GameCode, GameId } from "@s2h/schema/swish";
import { GameNotFound } from "@s2h/swish/errors";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import { kingdomino } from "./engine.ts";

// --- Durable Object ----------------------------------------------------------

export class KingdominoEngineDO extends Cloudflare.DurableObject<KingdominoEngineDO>()(
	"KingdominoEngineDO",
	Effect.gen( function* () {
		const channels = yield* GameChannel;
		const state = yield* Cloudflare.DurableObjectState;
		return kingdomino.pipe(
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

export const KingdominoApiLive = ( ns: Cloudflare.DurableObject<KingdominoEngineDO> ) =>
	HttpApiBuilder.group( StairwayAPI, "kingdomino", handlers =>
		Effect.gen( function* () {
			const db = yield* Database;
			return handlers
				.handle( "createGame", ( { payload } ) => Effect.gen( function* () {
					const { user } = yield* AuthContext;
					const game = yield* Effect.promise(
						() => db.insert( games )
							.values( { game: "kingdomino" } )
							.returning()
							.then( g => g[ 0 ] )
					);

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
					const game = yield* Effect.promise(
						() => db.select().from( games )
							.where( ops.and(
								ops.eq( games.game, "kingdomino" ),
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

				.handle( "getState", ( { params, payload } ) => Effect.gen( function* () {
					const client = ns.getByName( params.gameId );
					return yield* client.getState( payload );
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
