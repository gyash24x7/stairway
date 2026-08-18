import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { DurableSchedule } from "@/platform/do/schedule.ts";
import { DurableStorage } from "@/platform/do/storage.ts";
import { WebSocketChannel } from "@/platform/do/ws.ts";
import { SwishStorage, SwishSync, SwishTimers } from "@/swish/server/services.ts";
import { PlayerId } from "@/swish/shared/schema.ts";

import type { DurableTransaction } from "@/platform/do/storage.ts";
import type { AlarmKind } from "@/swish/server/services.ts";

const KEY_GAME_DATA = "data";
const KEY_LOG_BASE = "log:base";
const KEY_LOG_CURSOR = "log:cursor";
const KEY_LOG_COUNT = "log:count";
const KEY_LOG_START_COMMIT = "log:start-commit";
const KEY_LOG_COMPLETE_COMMIT = "log:complete-commit";

/**
 * The commit log is one key per commit — `log:commit:<index>` — rather than one
 * key holding the whole array. A single array is rewritten in full on every
 * commit and would eventually exceed a Durable Object's 128 KiB per-value cap,
 * which puts a hard ceiling on how long a game may run.
 *
 * `log:count` bounds the log: commits live at indices `0 .. count - 1`. Forking
 * the history is therefore a single write of a smaller count, not a rewrite —
 * commits past it are unreachable and get overwritten as the log regrows.
 */
const KEY_LOG_COMMIT_PREFIX = "log:commit";

/**
 * A checkpoint is the materialized record folded through one commit, written
 * every `CHECKPOINT_INTERVAL` commits at `log:ckpt:<index>` so a rebuild replays
 * a bounded tail instead of the game's entire history.
 */
const KEY_LOG_CHECKPOINT_PREFIX = "log:ckpt";

/**
 * Which seats the bot policy is playing. Sits outside `log:*` and `data` on
 * purpose: it schedules the game rather than describing it, so it must not fold
 * into events, travel with the cursor, or rewind under undo. The other
 * scheduling fact — the pending seat's deadline — belongs to `SwishTimers`,
 * which arms the alarm that enforces it.
 */
const KEY_AUTO_PLAY = "prefs:auto-play";

/**
 * How many commits a checkpoint covers, and so the most commits a rebuild ever
 * replays. Every checkpoint costs one stored copy of the record, so this trades
 * storage against rebuild cost. A checkpoint is a full record, so it is bound by
 * the same 128 KiB per-value cap as the materialized one.
 */
const CHECKPOINT_INTERVAL = 32;

/**
 * A checkpoint as stored: the record folded through one commit, stamped with
 * that commit's id. Forking the log replaces the commit at a position without
 * touching the checkpoint sitting beside it, so the id is what tells the two
 * apart — a mismatch means the checkpoint belongs to a history that no longer
 * exists, and it is skipped until a later commit overwrites it.
 */
type StoredCheckpoint<Data> = {
	readonly commitId: string;
	readonly data: Data;
};

/**
 * The key one commit lives under.
 * @param index - The commit's position in the log.
 * @returns That commit's storage key.
 */
const commitKey = ( index: number ) => `${ KEY_LOG_COMMIT_PREFIX }:${ index }`;

/**
 * The key the checkpoint taken at one commit lives under.
 * @param index - The commit the checkpoint folds through.
 * @returns That checkpoint's storage key.
 */
const checkpointKey = ( index: number ) => `${ KEY_LOG_CHECKPOINT_PREFIX }:${ index }`;

/**
 * The newest position a checkpoint could sit at, at or before a cursor.
 * Checkpoints land on every `CHECKPOINT_INTERVAL`-th commit, so this is
 * arithmetic; whether one was actually written there is a separate question.
 *
 * @param cursor - The position being rebuilt at.
 * @returns The candidate checkpoint index, or `-1` when none can exist.
 */
const checkpointIndexAtOrBefore = ( cursor: number ) =>
	Math.floor( ( cursor + 1 ) / CHECKPOINT_INTERVAL ) * CHECKPOINT_INTERVAL - 1;

/**
 * Reads a counter the log keeps, falling back when it has never been written.
 *
 * @param txn - The storage handle to read through.
 * @param key - The counter's key.
 * @param fallback - What an unwritten counter reads as.
 * @returns The stored counter, or the fallback.
 */
const readCounter = ( txn: DurableTransaction, key: string, fallback: number ) => txn
	.get<number>( key )
	.pipe( Effect.map( value => value ?? fallback ) );

/**
 * Reads the cursor: the index of the newest applied commit.
 * @param txn - The storage handle to read through.
 * @returns The cursor, or `-1` when nothing has been applied.
 */
const readCursorFrom = ( txn: DurableTransaction ) => readCounter( txn, KEY_LOG_CURSOR, -1 );

/**
 * Reads the seats currently played by the bot policy.
 * @param txn - The storage handle to read through.
 * @returns Player id → whether that seat is on autoplay.
 */
const readAutoPlayFrom = ( txn: DurableTransaction ) => txn
	.get<Record<PlayerId, boolean>>( KEY_AUTO_PLAY )
	.pipe( Effect.map( autoPlay => autoPlay ?? {} as Record<PlayerId, boolean> ) );

/**
 * The engine's store backed by a Durable Object's storage: the commit log, the
 * record it folds into, and the scheduling facts beside them, all laid out over
 * the flat key space `DurableStorage` exposes.
 *
 * Values are written and read raw — no schema encode or decode — since
 * structured-clone storage is trusted to preserve them. Every command's writes
 * go through one `transaction`, so a mid-command failure can never leave the log
 * disagreeing with the materialized record.
 */
export const SwishStorageLive = Layer.effect( SwishStorage, Effect.gen( function* () {
	const storage = yield* DurableStorage;

	return SwishStorage.of( {

		readRecord: <Data>() => storage.get<Data>( KEY_GAME_DATA ),

		readBase: <Data>() => storage.get<Data>( KEY_LOG_BASE ),

		readCommit: <Commit>( index: number ) => storage.get<Commit>( commitKey( index ) ),

		readCommitCount: () => readCounter( storage, KEY_LOG_COUNT, 0 ),

		readCursor: () => readCursorFrom( storage ),

		readStartCommitCursor: () => readCounter( storage, KEY_LOG_START_COMMIT, -1 ),

		readCompletedCommitCursor: () => readCounter( storage, KEY_LOG_COMPLETE_COMMIT, -1 ),

		/**
		 * Walks back one interval at a time, skipping a position whose checkpoint is
		 * missing or belongs to a forked-away history, so a stale one costs an extra
		 * read rather than a wrong rebuild.
		 */
		nearestCheckpoint: <Data>( cursor: number ) => Effect.gen( function* () {
			for (
				let index = checkpointIndexAtOrBefore( cursor );
				index >= 0;
				index -= CHECKPOINT_INTERVAL
			) {
				const checkpoint = yield* storage.get<StoredCheckpoint<Data>>( checkpointKey( index ) );
				if ( !checkpoint ) {
					continue;
				}

				const commit = yield* storage.get<{ readonly id: string }>( commitKey( index ) );
				if ( commit && commit.id === checkpoint.commitId ) {
					return { index, data: checkpoint.data };
				}
			}

			return undefined;
		} ),

		writeGenesis: <Data>( genesis: Data ) => storage.transaction(
			Effect.fn( function* ( txn ) {
				yield* txn.put( KEY_LOG_BASE, genesis );
				yield* txn.put( KEY_LOG_COUNT, 0 );
				yield* txn.put( KEY_LOG_CURSOR, -1 );
				yield* txn.put( KEY_GAME_DATA, genesis );
			} )
		),

		writeRecord: <Data>( record: Data ) => storage.put( KEY_GAME_DATA, record ),

		writeCommit: ( { commit, stamp, marksStart, marksComplete } ) => storage.transaction(
			Effect.fn( function* ( txn ) {
				const cursor = yield* readCursorFrom( txn );
				const next = cursor + 1;

				yield* txn.put( commitKey( next ), commit );
				yield* txn.put( KEY_LOG_COUNT, next + 1 );
				yield* txn.put( KEY_LOG_CURSOR, next );

				const record = stamp( next + 1 );
				yield* txn.put( KEY_GAME_DATA, record );

				if ( ( next + 1 ) % CHECKPOINT_INTERVAL === 0 ) {
					yield* txn.put( checkpointKey( next ), { commitId: commit.id, data: record } );
				}

				if ( marksStart ) {
					yield* txn.put( KEY_LOG_START_COMMIT, next );
				}

				if ( marksComplete ) {
					yield* txn.put( KEY_LOG_COMPLETE_COMMIT, next );
				}

				return record;
			} )
		),

		moveCursor: <Data>( cursor: number, record: Data ) => storage.transaction(
			Effect.fn( function* ( txn ) {
				yield* txn.put( KEY_LOG_CURSOR, cursor );
				yield* txn.put( KEY_GAME_DATA, record );
			} )
		),

		readAutoPlay: () => readAutoPlayFrom( storage ),

		writeAutoPlay: ( playerId, enabled ) => storage.transaction(
			Effect.fn( function* ( txn ) {
				const autoPlay = yield* readAutoPlayFrom( txn );
				autoPlay[ playerId ] = enabled;
				yield* txn.put( KEY_AUTO_PLAY, autoPlay );
			} )
		),

		clear: () => storage.clear()
	} );
} ) );

/**
 * The engine's fan-out over this object's WebSocket channel. One state change
 * is one push per connected socket: a seated player is sent their own envelope,
 * and anyone else watching the table is sent the table's.
 *
 * The address is not read — a game's Durable Object *is* the game, so every
 * socket here is already watching the game being published.
 */
export const SwishSyncLive = Layer.effect( SwishSync, Effect.gen( function* () {
	const channel = yield* WebSocketChannel;

	return SwishSync.of( {
		publish: Effect.fn( function* ( views ) {
			const audience = yield* channel.audience();

			const messages = new Map(
				audience.map( userId => {
					const view = views.players[ PlayerId.make( userId ) ] ?? views.table;
					return [ userId, JSON.stringify( view ) ] as const;
				} )
			);

			yield* channel.publishMessages( messages );
		} )
	} );
} ) );

/**
 * The names the engine's timers are scheduled under. An `AlarmKind` is the whole
 * identity of a timer, so re-arming one moves the entry already sitting under
 * that name rather than adding a second beside it.
 */
const ALARM_KINDS = [ "auto-start", "bot", "interaction-timeout", "move-timeout" ] as const;

const isAlarmKind = ( id: string ): id is AlarmKind =>
	( ALARM_KINDS as ReadonlyArray<string> ).includes( id );

/**
 * The engine's timers over `DurableSchedule`, which multiplexes them onto the
 * object's single wake-up.
 *
 * Each `AlarmKind` is one named entry, so arming a turn is a write per clock and
 * nothing has to be rebuilt around the timers it must leave alone — `auto-start`
 * survives a `rearm` because `rearm` never names it, rather than because it is
 * carried across a rewrite.
 *
 * The published deadline is read back out of the schedule rather than stored
 * beside it, which is what makes a move clock one fact instead of two: the
 * instant the alarm fires and the instant a client counts down to are the same
 * record, so they cannot drift and a spent one cannot be left behind.
 */
export const SwishTimersLive = Layer.effect( SwishTimers, Effect.gen( function* () {
	const schedule = yield* DurableSchedule;

	/**
	 * Arms one clock, or drops it when the turn does not run under it.
	 *
	 * @param kind - The timer to arm.
	 * @param at - When it comes due, or `undefined` for no such clock this turn.
	 */
	const arm = ( kind: AlarmKind, at: number | undefined ) =>
		at === undefined ? schedule.cancel( kind ) : schedule.set( kind, at );

	return SwishTimers.of( {

		rearm: ( turn ) => Effect.gen( function* () {
			const now = yield* Clock.currentTimeMillis;

			yield* arm( "bot", turn.bot === undefined ? undefined : now + turn.bot );

			yield* arm(
				"move-timeout",
				turn.moveTimeout === undefined ? undefined : now + turn.moveTimeout
			);

			// A frame deadline already behind us belongs to a frame on its way to
			// being settled; waking at zero would put the host in a loop.
			yield* arm(
				"interaction-timeout",
				turn.frameDeadline !== undefined && turn.frameDeadline > now
					? turn.frameDeadline
					: undefined
			);
		} ),

		armAutoStart: ( delayMillis ) => Effect.gen( function* () {
			const now = yield* Clock.currentTimeMillis;
			yield* schedule.set( "auto-start", now + delayMillis );
		} ),

		/**
		 * Derived from the move clock's own entry, so there is no second copy to
		 * fall out of step with it.
		 */
		deadline: () => schedule.list().pipe(
			Effect.map( entries => entries.find( entry => entry.id === "move-timeout" )?.at )
		),

		cancelAll: () => Effect.gen( function* () {
			for ( const kind of ALARM_KINDS ) {
				yield* schedule.cancel( kind );
			}
		} ),

		/**
		 * Names the engine does not own are dropped from the result rather than
		 * reported. `due()` has already cleared them from the schedule, so nothing
		 * else may share this object's timers.
		 */
		due: () => schedule.due().pipe( Effect.map( ids => ids.filter( isAlarmKind ) ) )
	} );
} ) );
