import { StairwayAPI } from "@s2h/contract/api";
import { toPlayerInfo } from "@s2h/contract/client";
import { AuthContext } from "@s2h/contract/middleware";
import { games } from "@s2h/platform/database/schema";
import { Database } from "@s2h/platform/database/service";
import { DurableSchedulerLive } from "@s2h/platform/do/scheduler";
import { DurableEventStoreLive, DurableGameStoreLive } from "@s2h/platform/do/stores";
import { DurableSyncLive, GameChannel } from "@s2h/platform/do/sync";
import { GameCode, GameId, PlayerId, PlayerInfo } from "@s2h/schema/swish";
import { WordleInitializeInput } from "@s2h/schema/wordle";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import { wordle } from "./engine.ts";

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

export const WordleApiLive = ( ns: Cloudflare.DurableObject<WordleEngineDO> ) =>
	HttpApiBuilder.group( StairwayAPI, "wordle", handlers =>
		Effect.gen( function* () {
			const db = yield* Database;
			return handlers
				.handle( "createGame", ( { payload } ) => Effect.gen( function* () {
					const { user } = yield* AuthContext;
					const game = yield* Effect.promise(
						() => db.insert( games )
							.values( { game: "wordle" } )
							.returning()
							.then( g => g[ 0 ] )
					);

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

				.handle( "getState", ( { params, payload } ) => Effect.gen( function* () {
					const client = ns.getByName( params.gameId );
					return yield* client.getState( payload );
				} ) )

				.handle( "guess", ( { params, payload } ) => Effect.gen( function* () {
					const { user } = yield* AuthContext;
					const client = ns.getByName( params.gameId );
					return yield* client.guess( payload, toPlayerInfo( user ) );
				} ) );
		} )
	);
