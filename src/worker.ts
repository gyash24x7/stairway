import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";
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
import { SwishDatabaseLive } from "@/platform/database/swish.ts";
import { ChatChannel } from "@/platform/do/chat.ts";
import { SwishArchiveLive } from "@/platform/kv/archive.ts";
import { SessionStoreLive } from "@/platform/kv/session.ts";
import { WebAuthnStoreLive } from "@/platform/kv/webauthn.ts";
import { OutboxQueue } from "@/platform/queue/outbox.ts";
import { OutboxConsumerLive } from "@/swish/server/outbox.ts";


const ApiLive = HttpApiBuilder.layer( StairwayAPI ).pipe(
	Layer.provide( AuthApiLive ),
	Layer.provide( ChatApiLive ),
	Layer.provide( CallbreakApiLive ),
	Layer.provide( FishApiLive ),
	Layer.provide( KingdominoApiLive ),
	Layer.provide( SplendorApiLive ),
	Layer.provide( TicTacToeApiLive ),
	Layer.provide( WordleApiLive ),
	Layer.provide( SwishArchiveLive ),
	Layer.provide( SwishDatabaseLive ),
	Layer.provide( AuthMiddlewareLive ),
	Layer.provide( SessionServiceLive ),
	Layer.provide( WebAuthnServiceLive ),
	Layer.provide( SessionStoreLive ),
	Layer.provide( WebAuthnStoreLive ),
	Layer.provide( Cloudflare.D1.QueryDatabaseBinding ),
	Layer.provide( Cloudflare.KV.ReadWriteNamespaceBinding )
);


/**
 * Everything the outbox consumer needs, resolved once when the worker boots
 * rather than per batch: the archive namespace and the database, over their
 * Cloudflare bindings.
 */
const OutboxConsumer = OutboxConsumerLive.pipe(
	Effect.provide( SwishArchiveLive ),
	Effect.provide( SwishDatabaseLive ),
	Effect.provide( Cloudflare.KV.ReadWriteNamespaceBinding ),
	Effect.provide( Cloudflare.D1.QueryDatabaseBinding )
);


export default Cloudflare.Worker(
	"ApiWorker",
	{ main: import.meta.url, compatibility: { flags: [ "nodejs_compat" ] } },
	Effect.gen( function* () {
		const { rpOrigin } = yield* RpConfig;

		const outboxQueue = yield* OutboxQueue;
		const closeOutGame = yield* OutboxConsumer;

		yield* Cloudflare.Queues.consumeQueueMessages(
			outboxQueue,
			{ batchSize: 1, maxWaitTime: "10 seconds", maxRetries: 5, retryDelay: "30 seconds" },
			stream => Stream.runForEach( stream, message => closeOutGame( message.body ) )
		);

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
	} ).pipe( Effect.provide( Cloudflare.Queues.EventSourceLive ) )
);
