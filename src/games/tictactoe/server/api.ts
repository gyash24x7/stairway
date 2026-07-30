import { StairwayAPI } from "@/api.ts";
import { AuthContext } from "@/auth/shared/middleware";
import { toPlayerInfo } from "@/client.ts";
import { TicTacToeInitializeInput } from "@/games/tictactoe/shared/schema";
import { games } from "@/platform/database/schema";
import { Database, ops } from "@/platform/database/service";
import { DurableSchedulerLive } from "@/platform/do/scheduler";
import { DurableEventStoreLive, DurableGameStoreLive } from "@/platform/do/stores";
import { DurableSyncLive, GameChannel } from "@/platform/do/sync";
import { GameNotFound } from "@/shared/swish/errors";
import { GameCode, GameId } from "@/shared/swish/schema";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import { tictactoe } from "./engine.ts";

// --- Durable Object ----------------------------------------------------------

export class TicTacToeEngineDO extends Cloudflare.DurableObject<TicTacToeEngineDO>()(
	"TicTacToeEngineDO",
	Effect.gen( function* () {
		const channels = yield* GameChannel;
		const state = yield* Cloudflare.DurableObjectState;
		return tictactoe.pipe(
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

export const TicTacToeApiLive = ( ns: Cloudflare.DurableObject<TicTacToeEngineDO> ) =>
	HttpApiBuilder.group( StairwayAPI, "tictactoe", handlers =>
		Effect.gen( function* () {
			const db = yield* Database;
			return handlers
				.handle( "createGame", ( { payload } ) => Effect.gen( function* () {
					const { user } = yield* AuthContext;
					const game = yield* Effect.promise(
						() => db.insert( games )
							.values( { game: "tic-tac-toe" } )
							.returning()
							.then( g => g[ 0 ] )
					);

					const input = TicTacToeInitializeInput.make( {
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
								ops.eq( games.game, "tic-tac-toe" ),
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

				.handle( "place", ( { params, payload } ) => Effect.gen( function* () {
					const { user } = yield* AuthContext;
					const client = ns.getByName( params.gameId );
					return yield* client.place( payload, toPlayerInfo( user ) );
				} ) );
		} )
	);
