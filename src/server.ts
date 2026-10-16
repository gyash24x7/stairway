import { fileURLToPath } from "node:url";

import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as BunRedis from "@effect/platform-bun/BunRedis";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as PgClient from "@effect/sql-pg/PgClient";

import * as SingleRunner from "effect/cluster/SingleRunner";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpStaticServer from "effect/http/HttpStaticServer";
import * as Persistence from "effect/persistence/Persistence";

import { AuthApi } from "@/auth/contract";
import { AuthApiLive } from "@/auth/server/handlers";
import { AuthMiddlewareLive } from "@/auth/server/middleware";
import { AuthRepositoryLive } from "@/auth/server/repository";
import { SessionServiceLive } from "@/auth/server/sessions";
import { WebAuthnServiceLive } from "@/auth/server/webauthn";
import { ChatAccessLive } from "@/chat/server/access";
import { ChatHistoryLive } from "@/chat/server/history";
import { IceServersLive } from "@/chat/server/ice";
import { ChatRoomsLive } from "@/chat/server/rooms";
import { ChatSocketRoute } from "@/chat/server/socket";
import { CallbreakApi } from "@/games/callbreak/contract";
import { CallbreakEngineLive } from "@/games/callbreak/server/engine";
import { CallbreakApiLive } from "@/games/callbreak/server/handlers";
import { CoupApi } from "@/games/coup/contract";
import { CoupEngineLive } from "@/games/coup/server/engine";
import { CoupApiLive } from "@/games/coup/server/handlers";
import { FishApi } from "@/games/fish/contract";
import { FishEngineLive } from "@/games/fish/server/engine";
import { FishApiLive } from "@/games/fish/server/handlers";
import { KingdominoApi } from "@/games/kingdomino/contract";
import { KingdominoEngineLive } from "@/games/kingdomino/server/engine";
import { KingdominoApiLive } from "@/games/kingdomino/server/handlers";
import { SplendorApi } from "@/games/splendor/contract";
import { SplendorEngineLive } from "@/games/splendor/server/engine";
import { SplendorApiLive } from "@/games/splendor/server/handlers";
import { TicTacToeApi } from "@/games/tictactoe/contract";
import { TicTacToeEngineLive } from "@/games/tictactoe/server/engine";
import { TicTacToeApiLive } from "@/games/tictactoe/server/handlers";
import { WordleApi } from "@/games/wordle/contract";
import { WordleEngineLive } from "@/games/wordle/server/engine";
import { WordleApiLive } from "@/games/wordle/server/handlers";
import { LobbyApi } from "@/lobby/contract";
import { LobbyApiLive } from "@/lobby/server/handlers";
import { NotificationsApi } from "@/notifications/contract";
import { NotificationsApiLive } from "@/notifications/server/handlers";
import { PushNotifierLive, PushRepositoryLive, VapidLive } from "@/notifications/server/push";
import { DatabaseLive } from "@/shared/utils/database";
import { GeneratorLive } from "@/shared/utils/generator";
import { WorldPresenceLive } from "@/world/server/presence";
import { WorldSocketRoute } from "@/world/server/socket";


const HealthCheckEndpoint = HttpApiEndpoint.get( "healthCheck", "/check", {
	success: Schema.Struct( { healthy: Schema.Boolean } )
} );

const HealthApiGroup = HttpApiGroup.make( "health" )
	.add( HealthCheckEndpoint )
	.prefix( "/health" );

export const HealthApi = HttpApi.make( "api" ).add( HealthApiGroup ).prefix( "/api" );

export const HealthApiLive = HttpApiBuilder.group(
	HealthApi,
	"health",
	handlers => handlers.handle( "healthCheck", () => Effect.succeed( { healthy: true } ) )
);

const PersistenceLive = Persistence.layerRedis;
const RedisLive = BunRedis.layerConfig( { url: Config.String( "REDIS_URL" ) } );
const PgClientLive = PgClient.layerConfig( {
	url: Config.Redacted( "DATABASE_URL" )
} );

/**
 * Named once because two layers need the same one: the API, whose engines
 * register their entities with it, and the chat socket, whose `ChatAccess`
 * sends those entities `membership` reads. `SingleRunner.layer()` builds a new
 * layer on every call, and layers are memoised by reference, so two calls
 * would be two runners with nothing registered on the second.
 */
const RunnerLive = SingleRunner.layer();

const StairwayApi = HttpApi.make( "api" )
	.addHttpApi( HealthApi )
	.addHttpApi( AuthApi )
	.addHttpApi( LobbyApi )
	.addHttpApi( NotificationsApi )
	.addHttpApi( TicTacToeApi )
	.addHttpApi( SplendorApi )
	.addHttpApi( KingdominoApi )
	.addHttpApi( FishApi )
	.addHttpApi( WordleApi )
	.addHttpApi( CallbreakApi )
	.addHttpApi( CoupApi );

const PushLive = PushNotifierLive.pipe(
	Layer.provideMerge( PushRepositoryLive ),
	Layer.provideMerge( VapidLive )
);

const StairwayEnginesLive = Layer.mergeAll(
	CallbreakEngineLive,
	CoupEngineLive,
	FishEngineLive,
	KingdominoEngineLive,
	SplendorEngineLive,
	TicTacToeEngineLive,
	WordleEngineLive
);

const StairwayApiLive = HttpApiBuilder.layer( StairwayApi ).pipe(
	Layer.provide( HealthApiLive ),
	Layer.provide( AuthApiLive ),
	Layer.provide( LobbyApiLive ),
	Layer.provide( NotificationsApiLive ),
	Layer.provide( CallbreakApiLive ),
	Layer.provide( CoupApiLive ),
	Layer.provide( FishApiLive ),
	Layer.provide( KingdominoApiLive ),
	Layer.provide( SplendorApiLive ),
	Layer.provide( TicTacToeApiLive ),
	Layer.provide( StairwayEnginesLive ),
	Layer.provide( WordleApiLive ),
	Layer.provide( AuthMiddlewareLive ),
	Layer.provide( SessionServiceLive ),
	Layer.provide( WebAuthnServiceLive ),
	Layer.provide( AuthRepositoryLive ),
	Layer.provide( PushLive ),
	Layer.provide( GeneratorLive ),
	Layer.provide( DatabaseLive )
);

const HttpApiLive = StairwayApiLive.pipe(
	Layer.provide( RunnerLive ),
	Layer.provide( PersistenceLive ),
	Layer.provide( RedisLive ),
	Layer.provide( PgClientLive ),
	Layer.provide( HttpServer.layerServices ),
	Layer.provide( BunServices.layer )
);

/**
 * The world's WebSocket sits on the router beside the `HttpApi` rather than
 * inside it — see `WorldSocketRoute`. It is given the same `PersistenceLive`
 * and `RedisLive` values as the API, and layers are memoised by reference, so
 * both share one Redis connection and read the same sessions.
 */
const WorldSocketLive = WorldSocketRoute.pipe(
	Layer.provide( WorldPresenceLive ),
	Layer.provide( SessionServiceLive ),
	Layer.provide( PersistenceLive ),
	Layer.provide( RedisLive ),
	Layer.provide( BunServices.layer )
);

/**
 * Each table's chat socket, beside the world's. `ChatAccess` asks the game
 * entities who a caller is, so it is built over the same engines, generator
 * and runner as the API — the same layer values, memoised, so one cluster.
 */
const ChatSocketLive = ChatSocketRoute.pipe(
	Layer.provide( ChatRoomsLive ),
	Layer.provide( ChatAccessLive ),
	Layer.provide( Layer.mergeAll( ChatHistoryLive, IceServersLive, SessionServiceLive ) ),
	Layer.provide( StairwayEnginesLive ),
	Layer.provide( PushLive ),
	Layer.provide( GeneratorLive ),
	Layer.provide( DatabaseLive ),
	Layer.provide( RunnerLive ),
	Layer.provide( PersistenceLive ),
	Layer.provide( RedisLive ),
	Layer.provide( PgClientLive ),
	Layer.provide( BunServices.layer )
);

const DIST = fileURLToPath( new URL( "../dist", import.meta.url ) );

const SpaLive = HttpStaticServer.layer( {
	root: DIST,
	spa: true,
	cacheControl: "no-cache"
} );

const AssetsLive = HttpStaticServer.layer( {
	root: `${ DIST }/assets`,
	prefix: "/assets",
	cacheControl: "public, max-age=31536000, immutable"
} );

const BunServerLive = BunHttpServer.layerConfig( {
	port: Config.Port( "PORT" ),
	idleTimeout: Config.succeed( 60 )
} );

const ApiLive = Layer.mergeAll( HttpApiLive, WorldSocketLive, ChatSocketLive, SpaLive, AssetsLive );
const ServerLive = HttpRouter.serve( ApiLive ).pipe( Layer.provide( BunServerLive ) );

Layer.launch( ServerLive ).pipe( BunRuntime.runMain );
