import { CallbreakRpcs } from "@s2h/callbreak/engine";
import { FishRpcs } from "@s2h/fish/engine";
import { KingdominoRpcs } from "@s2h/kingdomino/engine";
import { SplendorRpcs } from "@s2h/splendor/engine";
import { type AlarmKind, EventStore, GameArchive, GameStore, Scheduler } from "@s2h/swish/services";
import { TicTacToeRpcs } from "@s2h/tictactoe/engine";
import { WordleRpcs } from "@s2h/wordle/engine";
import { RuntimeContext } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization";
import * as RpcServer from "effect/unstable/rpc/RpcServer";

const KEY_GAME = "gameData";
const KEY_LOG_BASE = "log:base";
const KEY_LOG_COMMITS = "log:commits";
const KEY_LOG_CURSOR = "log:cursor";
const KEY_ALARM = "alarm:kind";

export const DurableGameStoreLive = Layer.effect( GameStore, Effect.gen( function* () {
	const ctx = yield* Cloudflare.DurableObjectState;
	const rc = yield* RuntimeContext;

	return GameStore.of( {
		load: <T>() => ctx.storage.get<T>( KEY_GAME ).pipe(
			Effect.map( ( value ) => Option.fromNullishOr( value ) ),
			Effect.provideService( RuntimeContext, rc )
		),

		save: ( encoded ) => ctx.storage.put( KEY_GAME, encoded )
			.pipe( Effect.provideService( RuntimeContext, rc ) ),

		clear: () => ctx.storage.deleteAll().pipe( Effect.provideService( RuntimeContext, rc ) )
	} );
} ) );

export const DurableEventStoreLive = Layer.effect( EventStore, Effect.gen( function* () {
	const ctx = yield* Cloudflare.DurableObjectState;
	const rc = yield* RuntimeContext;

	const readCommits = ctx.storage.get<ReadonlyArray<unknown>>( KEY_LOG_COMMITS )
		.pipe( Effect.map( ( c ) => c ?? [] ) );

	const readCursor = ctx.storage.get<number>( KEY_LOG_CURSOR )
		.pipe( Effect.map( ( c ) => c ?? -1 ) );

	return EventStore.of( {
		setBase: ( encoded ) => Effect.gen( function* () {
			yield* ctx.storage.put( KEY_LOG_BASE, encoded );
			yield* ctx.storage.put( KEY_LOG_COMMITS, [] );
			yield* ctx.storage.put( KEY_LOG_CURSOR, -1 );
		} ).pipe( Effect.provideService( RuntimeContext, rc ) ),

		append: ( commit ) => Effect.gen( function* () {
			const commits = yield* readCommits;
			const cursor = yield* readCursor;
			const kept = [ ...commits.slice( 0, cursor + 1 ), commit ];

			yield* ctx.storage.put( KEY_LOG_COMMITS, kept );
			yield* ctx.storage.put( KEY_LOG_CURSOR, kept.length - 1 );
		} ).pipe( Effect.provideService( RuntimeContext, rc ) ),

		moveCursor: ( delta ) => Effect.gen( function* () {
			const commits = yield* readCommits;
			const cursor = yield* readCursor;
			const next = cursor + delta;
			if ( next < -1 || next > commits.length - 1 ) {
				return Option.none();
			}
			yield* ctx.storage.put( KEY_LOG_CURSOR, next );
			const movedOver = delta === -1 ? commits[ cursor ] : commits[ next ];
			return Option.fromNullishOr( movedOver );
		} ).pipe( Effect.provideService( RuntimeContext, rc ) ),

		read: Effect.gen( function* () {
			const base = yield* ctx.storage.get<unknown>( KEY_LOG_BASE );
			const commits = yield* readCommits;
			const cursor = yield* readCursor;
			return { base, commits, cursor };
		} ).pipe( Effect.provideService( RuntimeContext, rc ) )
	} );
} ) );

export const DurableSchedulerLive = Layer.effect( Scheduler, Effect.gen( function* () {
	const ctx = yield* Cloudflare.DurableObjectState;
	const rc = yield* RuntimeContext;

	return Scheduler.of( {
		schedule: ( delayMillis, alarm ) => Effect.gen( function* () {
			yield* ctx.storage.put( KEY_ALARM, alarm );
			yield* ctx.storage.setAlarm( Date.now() + delayMillis );
		} ).pipe( Effect.provideService( RuntimeContext, rc ) ),

		cancel: Effect.gen( function* () {
			yield* ctx.storage.deleteAlarm();
			yield* ctx.storage.delete( KEY_ALARM );
		} ).pipe( Effect.provideService( RuntimeContext, rc ) ),

		read: ctx.storage.get<AlarmKind>( KEY_ALARM ).pipe(
			Effect.map( ( value ) => Option.fromNullishOr( value ) ),
			Effect.provideService( RuntimeContext, rc )
		)
	} );
} ) );

export const GamesArchiveKV = Cloudflare.KV.Namespace( "swish/cf/Archive" );

export const KVArchiveLive = Layer.effect( GameArchive, Effect.gen( function* () {
	const kv = yield* Cloudflare.KV.ReadWriteNamespace( GamesArchiveKV );
	const rc = yield* RuntimeContext;

	return GameArchive.of( {
		put: ( key, encoded ) => kv.put( key, JSON.stringify( encoded ) )
			.pipe( Effect.provideService( RuntimeContext, rc ), Effect.orDie ),

		get: ( key ) => Effect.gen( function* () {
			const value = yield* kv.get( key, "json" );
			return !value ? Option.none() : Option.some( value );
		} ).pipe( Effect.provideService( RuntimeContext, rc ), Effect.orDie )
	} );
} ) ).pipe( Layer.provide( Cloudflare.KV.ReadWriteNamespaceBinding ) );

export const DurableSwishLive = Layer.mergeAll(
	DurableGameStoreLive,
	DurableEventStoreLive,
	DurableSchedulerLive,
	KVArchiveLive
);

export class WordleEngineDO extends Cloudflare.RpcDurableObject<WordleEngineDO>()(
	"cf/WordleEngine",
	{ schema: WordleRpcs },
	Effect.gen( function* () {
		return Effect.gen( function* () {
			return RpcServer.toHttpEffect( WordleRpcs ).pipe(
				Effect.provide( Layer.mergeAll(
					WordleRpcs.layer.pipe( Layer.provide( DurableSwishLive ) ),
					RpcSerialization.layerNdjson
				) )
			);
		} );
	} )
) {}

export class TicTacToeEngineDO extends Cloudflare.RpcDurableObject<TicTacToeEngineDO>()(
	"cf/TicTacToeEngine",
	{ schema: TicTacToeRpcs },
	Effect.gen( function* () {
		return Effect.gen( function* () {
			return RpcServer.toHttpEffect( TicTacToeRpcs ).pipe(
				Effect.provide( Layer.mergeAll(
					TicTacToeRpcs.layer.pipe( Layer.provide( DurableSwishLive ) ),
					RpcSerialization.layerNdjson
				) )
			);
		} );
	} )
) {}

export class SplendorEngineDO extends Cloudflare.RpcDurableObject<SplendorEngineDO>()(
	"cf/SplendorEngine",
	{ schema: SplendorRpcs },
	Effect.gen( function* () {
		return Effect.gen( function* () {
			return RpcServer.toHttpEffect( SplendorRpcs ).pipe(
				Effect.provide( Layer.mergeAll(
					SplendorRpcs.layer.pipe( Layer.provide( DurableSwishLive ) ),
					RpcSerialization.layerNdjson
				) )
			);
		} );
	} )
) {}

export class FishEngineDO extends Cloudflare.RpcDurableObject<FishEngineDO>()(
	"cf/FishEngine",
	{ schema: FishRpcs },
	Effect.gen( function* () {
		return Effect.gen( function* () {
			return RpcServer.toHttpEffect( FishRpcs ).pipe(
				Effect.provide( Layer.mergeAll(
					FishRpcs.layer.pipe( Layer.provide( DurableSwishLive ) ),
					RpcSerialization.layerNdjson
				) )
			);
		} );
	} )
) {}

export class CallbreakEngineDO extends Cloudflare.RpcDurableObject<CallbreakEngineDO>()(
	"cf/CallbreakEngine",
	{ schema: CallbreakRpcs },
	Effect.gen( function* () {
		return Effect.gen( function* () {
			return RpcServer.toHttpEffect( CallbreakRpcs ).pipe(
				Effect.provide( Layer.mergeAll(
					CallbreakRpcs.layer.pipe( Layer.provide( DurableSwishLive ) ),
					RpcSerialization.layerNdjson
				) )
			);
		} );
	} )
) {}

export class KingdominoEngineDO extends Cloudflare.RpcDurableObject<KingdominoEngineDO>()(
	"cf/KingdominoEngine",
	{ schema: KingdominoRpcs },
	Effect.gen( function* () {
		return Effect.gen( function* () {
			return RpcServer.toHttpEffect( KingdominoRpcs ).pipe(
				Effect.provide( Layer.mergeAll(
					KingdominoRpcs.layer.pipe( Layer.provide( DurableSwishLive ) ),
					RpcSerialization.layerNdjson
				) )
			);
		} );
	} )
) {}
