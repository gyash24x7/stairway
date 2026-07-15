import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Etag from "effect/unstable/http/Etag";
import * as HttpPlatform from "effect/unstable/http/HttpPlatform";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import { StairwayAPI } from "./api";
import { AuthApiLive, AuthHttpContextLive } from "./auth";
import {
	CallbreakApiLive,
	FishApiLive,
	HealthApiLive,
	KingdominoApiLive,
	SplendorApiLive,
	TicTacToeApiLive,
	WordleApiLive
} from "./handlers";

export default class StairwayApiWorker extends Cloudflare.Worker<StairwayApiWorker>()(
	"StairwayApi",
	{ main: import.meta.url },
	Effect.gen( function* () {
		return {
			fetch: yield* HttpRouter.toHttpEffect(
				HttpApiBuilder.layer( StairwayAPI ).pipe(
					Layer.provide( HealthApiLive ),
					Layer.provide( AuthApiLive ),
					Layer.provide( WordleApiLive ),
					Layer.provide( TicTacToeApiLive ),
					Layer.provide( SplendorApiLive ),
					Layer.provide( FishApiLive ),
					Layer.provide( CallbreakApiLive ),
					Layer.provide( KingdominoApiLive ),
					Layer.provide( AuthHttpContextLive ),
					Layer.provide( [ Etag.layer, HttpPlatform.layer, Path.layer ] ),
					Layer.provide(
						HttpRouter.cors( {
							allowedOrigins: [ "*" ],
							allowedMethods: [ "GET", "POST", "OPTIONS" ],
							allowedHeaders: [ "Content-Type" ]
						} )
					)
				)
			)
		};
	} )
) {}
