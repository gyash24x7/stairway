import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import type { ScheduledEntry } from "@/platform/do/schedule.ts";
import { DurableSchedule } from "@/platform/do/schedule.ts";
import type { DurableTransaction } from "@/platform/do/storage.ts";
import { DurableStorage } from "@/platform/do/storage.ts";
import { SwishStorageLive, SwishTimersLive } from "@/platform/do/swish.ts";
import type { GameAddress } from "@/swish/server/services.ts";
import { SwishArchive, SwishSync } from "@/swish/server/services.ts";

/**
 * `DurableStorage` over a plain `Map`. The commit log's key layout, its
 * checkpoint interval and its fork-by-shrinking all live in `SwishStorageLive`,
 * which is layered on top of this — so faking the flat store rather than the
 * service means the tests exercise the real log.
 *
 * A Durable Object serializes its own storage, so `transaction` here is simply
 * "run the function", exactly as the live layer's is.
 *
 * @param cells - The backing map. Pass one in to inspect it after a run.
 * @returns The `DurableStorage` layer over it.
 */
export const InMemoryDurableStorage = ( cells: Map<string, unknown> = new Map() ) => {
	const txn: DurableTransaction = {
		get: <T>( key: string ) => Effect.sync( () => cells.get( key ) as T | undefined ),
		put: <T>( key: string, value: T ) => Effect.sync( () => void cells.set( key, value ) )
	};

	return Layer.succeed( DurableStorage, DurableStorage.of( {
		...txn,
		list: <T>( prefix: string ) => Effect.sync( () =>
			[ ...cells.entries() ]
				.filter( ( [ key ] ) => key.startsWith( prefix ) )
				.map( ( [ , value ] ) => value as T )
		),
		transaction: fn => fn( txn ),
		clear: () => Effect.sync( () => cells.clear() )
	} ) );
};

/**
 * `DurableSchedule` over a `Map` of name to due time. Nothing fires on its own —
 * `due()` reports what is past `now`, which is what lets a test drive `alarm()`
 * deliberately instead of waiting on a clock.
 *
 * @param now - Reads the current time. Defaults to the wall clock.
 * @param pending - The backing map. Pass one in to see which timers are armed.
 * @returns The `DurableSchedule` layer.
 */
export const InMemoryDurableSchedule = (
	now: () => number = () => Date.now(),
	pending: Map<string, number> = new Map()
) => {
	return Layer.succeed( DurableSchedule, DurableSchedule.of( {
		set: ( id, at ) => Effect.sync( () => void pending.set( id, at ) ),
		cancel: id => Effect.sync( () => void pending.delete( id ) ),
		list: () => Effect.sync( () =>
			[ ...pending.entries() ]
				.map( ( [ id, at ] ): ScheduledEntry => ( { id, at } ) )
				.sort( ( a, b ) => a.at - b.at )
		),
		due: () => Effect.sync( () => {
			const ready = [ ...pending.entries() ]
				.filter( ( [ , at ] ) => at <= now() )
				.map( ( [ id ] ) => id );

			ready.forEach( id => pending.delete( id ) );
			return ready;
		} )
	} ) );
};

/** `SwishArchive` over a `Map`, so a completed game can be read back. */
export const InMemorySwishArchive = ( saved: Map<string, unknown> = new Map() ) =>
	Layer.succeed( SwishArchive, SwishArchive.of( {
		save: ( address: GameAddress, encoded: unknown ) =>
			Effect.sync( () => void saved.set( `${ address.game }:${ address.id }`, encoded ) ),
		load: <T>( address: GameAddress ) => Effect.sync( () =>
			Option.fromNullishOr( saved.get( `${ address.game }:${ address.id }` ) as T | undefined )
		)
	} ) );

/** `SwishSync` that keeps every push, so a test can assert on what was broadcast. */
export const InMemorySwishSync = ( published: Array<unknown> = [] ) =>
	Layer.succeed( SwishSync, SwishSync.of( {
		publish: views => Effect.sync( () => void published.push( views ) )
	} ) );

/**
 * Every host capability an engine needs, backed by memory: the real commit log
 * and the real timer multiplexing over in-memory primitives, plus recording
 * fakes for the archive and the fan-out.
 *
 * @param [options] - Collectors to inspect after a run, and the clock to read.
 * @returns One layer providing all four swish services.
 */
export const TestHost = ( options: {
	readonly cells?: Map<string, unknown>;
	readonly saved?: Map<string, unknown>;
	readonly published?: Array<unknown>;
	readonly pending?: Map<string, number>;
	readonly now?: () => number;
} = {} ) => Layer.mergeAll(
	SwishStorageLive.pipe( Layer.provide( InMemoryDurableStorage( options.cells ) ) ),
	SwishTimersLive.pipe(
		Layer.provide( InMemoryDurableSchedule( options.now, options.pending ) )
	),
	InMemorySwishArchive( options.saved ),
	InMemorySwishSync( options.published )
);
