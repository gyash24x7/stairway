import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Etag from "effect/unstable/http/Etag";
import * as HttpPlatform from "effect/unstable/http/HttpPlatform";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { StairwayAPI } from "@/api.ts";
import { AuthApiLive } from "@/auth/server/api.ts";
import { AuthMiddlewareLive } from "@/auth/server/middleware.ts";
import { CallbreakApiLive, CallbreakEngineDO } from "@/games/callbreak/server/api.ts";
import { FishApiLive, FishEngineDO } from "@/games/fish/server/api.ts";
import { KingdominoApiLive, KingdominoEngineDO } from "@/games/kingdomino/server/api.ts";
import { SplendorApiLive, SplendorEngineDO } from "@/games/splendor/server/api.ts";
import { TicTacToeApiLive, TicTacToeEngineDO } from "@/games/tictactoe/server/api.ts";
import { WordleApiLive, WordleEngineDO } from "@/games/wordle/server/api.ts";
import { WebAuthnStoreLive } from "@/platform/kv/webauthn.ts";
import { SessionStoreLive } from "@/platform/kv/session.ts";
import { SessionServiceLive } from "@/auth/server/session.ts";
import { WebAuthnServiceLive } from "@/auth/server/webauthn.ts";

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
					Layer.provide( SessionServiceLive ),
					Layer.provide( WebAuthnServiceLive ),
					Layer.provide( SessionStoreLive ),
					Layer.provide( WebAuthnStoreLive ),
					Layer.provide( Cloudflare.D1.QueryDatabaseBinding ),
					Layer.provide( Cloudflare.KV.ReadWriteNamespaceBinding ),
					Layer.provide( Alchemy.RuntimeContext.phantom ),
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
