import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Etag from "effect/unstable/http/Etag";
import * as HttpPlatform from "effect/unstable/http/HttpPlatform";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

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
import { GameChannel } from "@/platform/do/sync.ts";

const HttpPlatformStub = Layer.succeed( HttpPlatform.HttpPlatform, {
	fileResponse: () => Effect.die( "HttpPlatform.fileResponse not supported" ),
	fileWebResponse: () => Effect.die( "HttpPlatform.fileWebResponse not supported" )
} );

const ApiLive = HttpApiBuilder.layer( StairwayAPI ).pipe(
	Layer.provide( CallbreakApiLive ),
	Layer.provide( FishApiLive ),
	Layer.provide( KingdominoApiLive ),
	Layer.provide( SplendorApiLive ),
	Layer.provide( TicTacToeApiLive ),
	Layer.provide( WordleApiLive ),
	Layer.provide( AuthApiLive ),
	Layer.provide( AuthMiddlewareLive ),
	Layer.provide( SessionServiceLive ),
	Layer.provide( WebAuthnServiceLive ),
	Layer.provide( SessionStoreLive ),
	Layer.provide( WebAuthnStoreLive ),
	Layer.provide( Cloudflare.D1.QueryDatabaseBinding ),
	Layer.provide( Cloudflare.KV.ReadWriteNamespaceBinding )
);

const ApiWorker = Cloudflare.Worker(
	"ApiWorker",
	{ main: import.meta.url, compatibility: { flags: [ "nodejs_compat" ] } },
	Effect.gen( function* () {
		const webOrigin = yield* Config.string( "WEBAUTHN_RP_ORIGIN" );

		yield* Effect.all( [
			WordleEngineDO,
			TicTacToeEngineDO,
			SplendorEngineDO,
			KingdominoEngineDO,
			FishEngineDO,
			CallbreakEngineDO
		] );

		const channels = yield* GameChannel;

		const ApiFetch = yield* HttpRouter.toHttpEffect(
			ApiLive.pipe(
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
		);

		return {
			fetch: Effect.gen( function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				const url = new URL( request.url, "http://sync" );

				if ( url.pathname.startsWith( "/sync/" ) ) {
					if ( request.headers[ "upgrade" ] !== "websocket" ) {
						return HttpServerResponse.text(
							"Expected Upgrade: websocket",
							{ status: 426 }
						);
					}

					// /sync/{gameName}/{gameId}?playerId={playerId}
					const [ _, _sync, gameName, gameId ] = url.pathname.split( "/" );
					if ( !gameName || !gameId ) {
						return HttpServerResponse.text( "Bad sync path", { status: 400 } );
					}

					const channel = `${ gameName }:${ gameId }`;
					return yield* channels.getByName( channel ).fetch( request );
				}

				return yield* ApiFetch;
			} )
		};
	} )
);

export default ApiWorker;
