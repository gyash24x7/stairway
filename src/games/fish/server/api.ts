import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { StairwayAPI } from "@/api.ts";
import { fish } from "@/games/fish/server/engine.ts";
import { buildConfig } from "@/games/fish/server/utils.ts";
import { FishConfig } from "@/games/fish/shared/schema.ts";
import { teamCountsFor } from "@/games/fish/shared/utils.ts";
import { makeGameApi, SwishDurableObject } from "@/swish/server/api.ts";
import { InvalidTeamConfig } from "@/swish/shared/schema.ts";

import type { FishCreateInput } from "@/games/fish/shared/schema.ts";


// --- Durable Object ----------------------------------------------------------

export class FishGame extends Cloudflare.DurableObject<FishGame>()(
	"FishGame",
	SwishDurableObject( fish )
) {}


// --- HTTP Api implementation -------------------------------------------------

export const FishApiLive = HttpApiBuilder.group( StairwayAPI, "fish", handlers =>
	Effect.gen( function* () {
		const api = yield* makeGameApi( {
			game: "fish",
			ns: yield* FishGame,
			chat: { text: false, reactions: true }
		} );

		return handlers
			.handle( "createGame", api.createGame(
				client => client.initialize,
				Effect.fn( function* ( payload: FishCreateInput ) {
					if ( !teamCountsFor( payload.playerCount ).includes( payload.teamCount ) ) {
						return yield* new InvalidTeamConfig( {
							reason: `${ payload.playerCount } seats do not split evenly between `
								+ `${ payload.teamCount } sides.`
						} );
					}

					return FishConfig.make(
						buildConfig( payload.playerCount, payload.type, payload.teamCount )
					);
				} )
			) )
			.handle( "join", api.join )
			.handle( "getView", api.getView( client => client.getState ) )
			.handle( "addBots", api.addBots )
			.handle( "joinTeam", api.joinTeam )
			.handle( "nameTeam", api.nameTeam )
			.handle( "leaveTeam", api.leaveTeam )
			.handle( "start", api.start )
			.handle( "askCard", api.move( client => client.askCard ) )
			.handle( "claimBook", api.move( client => client.claimBook ) )
			.handle( "transferTurn", api.move( client => client.transferTurn ) )
			.handle( "setAutoPlay", api.setAutoPlay )
			.handle( "rematch", api.rematch(
				client => client.initialize,
				client => client.getState
			) )
			.handle( "undo", api.undo )
			.handle( "redo", api.redo );
	} )
);
