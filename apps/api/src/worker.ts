import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Etag from "effect/unstable/http/Etag";
import * as HttpPlatform from "effect/unstable/http/HttpPlatform";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import { StairwayAPI } from "./api";
import {
	CallbreakApiLive,
	FishApiLive,
	HealthApiLive,
	KingdominoApiLive,
	SplendorApiLive,
	TicTacToeApiLive,
	WordleApiLive
} from "./handlers";
import { GameChannel } from "./sync";

// `GET /sync/:gameName/:gameId` — the realtime WebSocket entry point. A browser
// can only reach a Durable Object through the Worker, so we forward the upgrade
// request straight to that game's `GameChannel` DO (`${gameName}:${gameId}`),
// whose `fetch` accepts the socket. Everything else falls through to the HttpApi.
const SYNC_PATH = /^\/sync\/([^/]+)\/([^/]+)\/?$/;

export default class StairwayApiWorker extends Cloudflare.Worker<StairwayApiWorker>()(
	"StairwayApi",
	{ main: import.meta.url },
	Effect.gen( function* () {
		const channels = yield* GameChannel;
		return {
			fetch: Effect.gen( function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				const match = new URL( request.url, "http://api" ).pathname.match( SYNC_PATH );
				if ( match ) {
					const [ , gameName, gameId ] = match;
					return yield* channels.getByName( `${ gameName }:${ gameId }` ).fetch( request );
				}

				return yield* HttpRouter.toHttpEffect(
					HttpApiBuilder.layer( StairwayAPI ).pipe(
						Layer.provide( HealthApiLive ),
						// Layer.provide( AuthApiLive ),
						Layer.provide( WordleApiLive ),
						Layer.provide( TicTacToeApiLive ),
						Layer.provide( SplendorApiLive ),
						Layer.provide( FishApiLive ),
						Layer.provide( CallbreakApiLive ),
						Layer.provide( KingdominoApiLive ),
						// Layer.provide( AuthService.layer ),
						// Layer.provide( DatabaseLive ),
						Layer.provide( [ Etag.layer, HttpPlatform.layer, Path.layer ] ),
						Layer.provide(
							HttpRouter.cors( {
								allowedOrigins: [ "*" ],
								allowedMethods: [ "GET", "POST", "OPTIONS" ],
								allowedHeaders: [ "Content-Type" ]
							} )
						)
					)
				);
			} )
		};
	} )
) {}
