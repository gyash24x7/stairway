import { CallbreakRpcs } from "@s2h/callbreak/engine";
import { FishRpcs } from "@s2h/fish/engine";
import { KingdominoRpcs } from "@s2h/kingdomino/engine";
import { SplendorRpcs } from "@s2h/splendor/engine";
import { type AlarmKind, EventStore, GameArchive, GameStore, Scheduler, Sync } from "@s2h/swish/services";
import { TicTacToeRpcs } from "@s2h/tictactoe/engine";
import { WordleRpcs } from "@s2h/wordle/engine";
import { RuntimeContext } from "alchemy";
import { GameChannel } from "./sync";
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
const KEY_TIMERS = "timers";

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

	type Timer = { at: number; alarm: AlarmKind };

	const readTimers = ctx.storage.get<Record<string, Timer>>( KEY_TIMERS )
		.pipe( Effect.map( ( t ) => t ?? {} ) );

	// Arm the DO's single alarm at the earliest pending timer (or clear it).
	const rearm = ( timers: Record<string, Timer> ) => Effect.gen( function* () {
		const times = Object.values( timers ).map( ( t ) => t.at );
		if ( times.length === 0 ) {
			yield* ctx.storage.deleteAlarm();
		} else {
			yield* ctx.storage.setAlarm( Math.min( ...times ) );
		}
	} );

	return Scheduler.of( {
		schedule: ( key, delayMillis, alarm ) => Effect.gen( function* () {
			const timers = yield* readTimers;
			timers[ key ] = { at: Date.now() + delayMillis, alarm };
			yield* ctx.storage.put( KEY_TIMERS, timers );
			yield* rearm( timers );
		} ).pipe( Effect.provideService( RuntimeContext, rc ) ),

		cancel: ( key ) => Effect.gen( function* () {
			const timers = yield* readTimers;
			delete timers[ key ];
			yield* ctx.storage.put( KEY_TIMERS, timers );
			yield* rearm( timers );
		} ).pipe( Effect.provideService( RuntimeContext, rc ) ),

		cancelAll: Effect.gen( function* () {
			yield* ctx.storage.delete( KEY_TIMERS );
			yield* ctx.storage.deleteAlarm();
		} ).pipe( Effect.provideService( RuntimeContext, rc ) ),

		// Return (and clear) every timer whose time has passed, then re-arm for the
		// next earliest. The DO `alarm()` handler calls this via `runBotTurn`.
		due: Effect.gen( function* () {
			const timers = yield* readTimers;
			const now = Date.now();
			const fired: Array<AlarmKind> = [];
			for ( const key of Object.keys( timers ) ) {
				const timer = timers[ key ]!;
				if ( timer.at <= now ) {
					fired.push( timer.alarm );
					delete timers[ key ];
				}
			}
			yield* ctx.storage.put( KEY_TIMERS, timers );
			yield* rearm( timers );
			return fired;
		} ).pipe( Effect.provideService( RuntimeContext, rc ) )
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

// Realtime fan-out: resolve the local `GameChannel` namespace and, on each
// broadcast, hand the per-audience snapshots to that game's channel DO
// (`${gameName}:${gameId}`), which pushes them to its connected sockets.
export const DurableSyncLive = Layer.effect( Sync, Effect.gen( function* () {
	const channels = yield* GameChannel;
	const rc = yield* RuntimeContext;

	return Sync.of( {
		broadcast: ( channel, snapshot ) => channels.getByName( channel ).broadcast( snapshot )
			.pipe( Effect.provideService( RuntimeContext, rc ), Effect.ignore )
	} );
} ) );

export const DurableSwishLive = Layer.mergeAll(
	DurableGameStoreLive,
	DurableEventStoreLive,
	DurableSchedulerLive,
	KVArchiveLive,
	DurableSyncLive
);

// #7 TODO — wire the DO `alarm()` so scheduled wake-ups actually fire. The
// multi-timer `Scheduler` above + `engine.runBotTurn` (which now drains `due`)
// are alarm-ready; what's missing is the DO alarm handler. `RpcDurableObject`
// props accept `& Partial<DurableObjectProps>`, whose `alarm?: (info?) =>
// Effect<void, never, never>` is the hook. It must run `<game>.runBotTurn`
// provided with `DurableSwishLive` (so the ambient DurableObjectState/RuntimeContext
// resolve the engine services). This was already unwired before the scheduler
// work, so auto-start/bot moves depend on completing this binding.
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
