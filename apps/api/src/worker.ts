import { AuthApiLive } from "@s2h/auth/api";
import { AuthMiddlewareLive } from "@s2h/auth/middleware";
import { BetterAuthLive } from "@s2h/auth/services";
import { CallbreakApiLive, CallbreakEngineDO } from "@s2h/callbreak/api";
import { StairwayAPI } from "@s2h/contract/api";
import { FishApiLive, FishEngineDO } from "@s2h/fish/api";
import { KingdominoApiLive, KingdominoEngineDO } from "@s2h/kingdomino/api";
import { DatabaseLive } from "@s2h/platform/database/service";
import { SplendorApiLive, SplendorEngineDO } from "@s2h/splendor/api";
import { TicTacToeApiLive, TicTacToeEngineDO } from "@s2h/tictactoe/api";
import { WordleApiLive, WordleEngineDO } from "@s2h/wordle/api";
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

const HealthApiLive = HttpApiBuilder.group( StairwayAPI, "health", handlers => handlers
	.handle( "healthCheck", () => Effect.succeed( { healthy: true } ) )
);

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
					Layer.provide( HealthApiLive ),
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
