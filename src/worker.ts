import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import {
	Etag,
	HttpPlatform,
	HttpRouter,
	HttpServerRequest,
	HttpServerResponse
} from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { StairwayAPI } from "@/api.ts";
import { AuthApiLive } from "@/auth/server/api.ts";
import { AuthMiddlewareLive } from "@/auth/server/middleware.ts";
import { SessionServiceLive } from "@/auth/server/session.ts";
import { RpConfig, WebAuthnServiceLive } from "@/auth/server/webauthn.ts";
import { ChatApiLive } from "@/chat/server/api.ts";
import { CallbreakApiLive, CallbreakGame } from "@/games/callbreak/server/api.ts";
import { FishApiLive, FishGame } from "@/games/fish/server/api.ts";
import { KingdominoApiLive, KingdominoGame } from "@/games/kingdomino/server/api.ts";
import { SplendorApiLive, SplendorGame } from "@/games/splendor/server/api.ts";
import { TicTacToeApiLive, TicTacToeGame } from "@/games/tictactoe/server/api.ts";
import { WordleApiLive, WordleGame } from "@/games/wordle/server/api.ts";
import { ChatChannel } from "@/platform/do/chat.ts";
import { PushStoreLive } from "@/platform/kv/push.ts";
import { SessionStoreLive } from "@/platform/kv/session.ts";
import { WebAuthnStoreLive } from "@/platform/kv/webauthn.ts";
import { PushApiLive } from "@/push/server/api.ts";
import { PushSenderLive } from "@/push/server/sender.ts";


const ApiLive = HttpApiBuilder.layer( StairwayAPI ).pipe(
	Layer.provide( AuthApiLive ),
	Layer.provide( ChatApiLive ),
	Layer.provide( PushApiLive ),
	Layer.provide( CallbreakApiLive ),
	Layer.provide( FishApiLive ),
	Layer.provide( KingdominoApiLive ),
	Layer.provide( SplendorApiLive ),
	Layer.provide( TicTacToeApiLive ),
	Layer.provide( WordleApiLive ),
	Layer.provide( AuthMiddlewareLive ),
	Layer.provide( SessionServiceLive ),
	Layer.provide( WebAuthnServiceLive ),
	Layer.provide( PushSenderLive ),
	Layer.provide( PushStoreLive ),
	Layer.provide( SessionStoreLive ),
	Layer.provide( WebAuthnStoreLive ),
	Layer.provide( Cloudflare.D1.QueryDatabaseBinding ),
	Layer.provide( Cloudflare.KV.ReadWriteNamespaceBinding )
);


export default Cloudflare.Worker(
	"ApiWorker",
	{ main: import.meta.url, compatibility: { flags: [ "nodejs_compat" ] } },
	Effect.gen( function* () {
		const { rpOrigin } = yield* RpConfig;

		const channels = {
			chat: yield* ChatChannel,
			callbreak: yield* CallbreakGame,
			fish: yield* FishGame,
			kingdomino: yield* KingdominoGame,
			splendor: yield* SplendorGame,
			wordle: yield* WordleGame,
			tictactoe: yield* TicTacToeGame
		};

		const ApiFetch = yield* HttpRouter.toHttpEffect(
			ApiLive.pipe(
				Layer.provide( [ Etag.layer, HttpPlatform.layer, Path.layer ] ),
				Layer.provide( FileSystem.layerNoop( {} ) ),
				Layer.provide(
					HttpRouter.cors( {
						allowedOrigins: [ rpOrigin ],
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
				const [ _, prefix, name ] = url.pathname.split( "/" );

				const channel = prefix && Object.hasOwn( channels, prefix )
					? channels[ prefix as keyof typeof channels ]
					: undefined;

				if ( channel ) {
					if ( request.headers[ "upgrade" ] !== "websocket" ) {
						return HttpServerResponse.text(
							"Expected Upgrade: websocket",
							{ status: 426 }
						);
					}

					if ( !name ) {
						return HttpServerResponse.text( `Bad ${ prefix } path`, { status: 400 } );
					}

					return yield* channel.getByName( name ).fetch( request );
				}

				return yield* ApiFetch;
			} )
		};
	} )
);
