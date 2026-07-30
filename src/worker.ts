import { StairwayAPI } from "@/api.ts";
import { AuthApiLive } from "@/auth/server/api";
import { AuthMiddlewareLive } from "@/auth/server/middleware";
import { BetterAuthLive } from "@/auth/server/services";
import { CallbreakApiLive, CallbreakEngineDO } from "@/games/callbreak/server/api";
import { FishApiLive, FishEngineDO } from "@/games/fish/server/api";
import { KingdominoApiLive, KingdominoEngineDO } from "@/games/kingdomino/server/api";
import { SplendorApiLive, SplendorEngineDO } from "@/games/splendor/server/api";
import { TicTacToeApiLive, TicTacToeEngineDO } from "@/games/tictactoe/server/api";
import { WordleApiLive, WordleEngineDO } from "@/games/wordle/server/api";
import { DatabaseLive } from "@/platform/database/service";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Etag from "effect/unstable/http/Etag";
import * as HttpPlatform from "effect/unstable/http/HttpPlatform";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

const HttpPlatformStub = Layer.succeed( HttpPlatform.HttpPlatform, {
	fileResponse: () => Effect.die( "HttpPlatform.fileResponse not supported" ),
	fileWebResponse: () => Effect.die( "HttpPlatform.fileWebResponse not supported" )
} );

const ApiWorker = Cloudflare.Worker(
	"ApiWorker",
	{ main: import.meta.url, compatibility: { flags: [ "nodejs_compat" ] } },
	Effect.gen( function* () {
		const webOrigin = yield* Config.string( "WEBAUTHN_RP_ORIGIN" );
		const wordleEngine = yield* WordleEngineDO;
		const ticTacToeEngine = yield* TicTacToeEngineDO;
		const splendorEngine = yield* SplendorEngineDO;
		const kingdominoEngine = yield* KingdominoEngineDO;
		const fishEngine = yield* FishEngineDO;
		const callbreakEngine = yield* CallbreakEngineDO;

		return {
			fetch: yield* HttpRouter.toHttpEffect(
				HttpApiBuilder.layer( StairwayAPI ).pipe(
					Layer.provide( CallbreakApiLive( callbreakEngine ) ),
					Layer.provide( FishApiLive( fishEngine ) ),
					Layer.provide( KingdominoApiLive( kingdominoEngine ) ),
					Layer.provide( SplendorApiLive( splendorEngine ) ),
					Layer.provide( TicTacToeApiLive( ticTacToeEngine ) ),
					Layer.provide( WordleApiLive( wordleEngine ) ),
					Layer.provide( AuthApiLive ),
					Layer.provide( AuthMiddlewareLive ),
					Layer.provide( BetterAuthLive ),
					Layer.provide( DatabaseLive ),
					Layer.provide( [ Etag.layer, HttpPlatformStub, Path.layer ] ),
					Layer.provide(
						HttpRouter.cors( {
							allowedOrigins: [ webOrigin ],
							allowedMethods: [ "GET", "POST", "OPTIONS" ],
							allowedHeaders: [ "Content-Type", "traceparent", "tracestate", "b3" ],
							credentials: true
						} )
					)
				)
			)
		};
	} )
);

export default ApiWorker;
