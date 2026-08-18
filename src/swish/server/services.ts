import * as Context from "effect/Context";

import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import type { GameId, PlayerId } from "@/swish/shared/schema.ts";

/**
 * Where one game lives, as far as a host is concerned: which game it is, and
 * which table. Both the fan-out and the cold store address a game this way, so
 * the string form — a channel name, an archive key — is theirs to choose rather
 * than something the engine formats and they parse back.
 */
export type GameAddress = {
	readonly game: string;
	readonly id: GameId;
};

/**
 * A rebuild shortcut the store found for the engine: the record as of one
 * commit, and the position that commit sits at. A checkpoint left over from a
 * history that has since been forked away is never handed back, so the engine
 * may fold straight from `index + 1` onwards.
 */
export type Checkpoint<Data> = {
	readonly index: number;
	readonly data: Data;
};

/**
 * One command's write to the log.
 * - commit: The commit to append, identified so a checkpoint can be matched to it.
 * - stamp: Builds the record to materialize, given the version the log assigned.
 * - marksStart: `true` when this commit is the one that started the game.
 * - marksComplete: `true` when this commit is the one that completed it.
 */
export type CommitWrite<Data, Commit> = {
	readonly commit: Commit;
	readonly stamp: ( version: number ) => Data;
	readonly marksStart: boolean;
	readonly marksComplete: boolean;
};

/**
 * The engine's store: the commit log, the record the log folds into, and the
 * autoplay map that sits beside them. Every read and write a command performs
 * is a method here, so how a commit is keyed, when a checkpoint is taken and what
 * a single transaction has to cover are the implementation's business rather than
 * the engine's.
 *
 * Values round-trip raw — nothing crossing this boundary is schema-encoded — so
 * the store is trusted to preserve whatever it was handed.
 *
 * Three invariants an implementation owes the engine:
 * - **The commits are contiguous**, from `0` to `commitCount - 1`. Committing
 *   after an undo forks the history by *shrinking* that count, so commits at or
 *   past it belong to a history that no longer exists and are never read.
 * - **`version === cursor + 1`**, the number of commits folded into the record.
 *   `writeCommit` hands its `stamp` the version it assigned, so the record it
 *   materializes carries the version of the log it was built from.
 * - **One command, one transaction.** Everything a `write*` touches lands
 *   atomically, or a mid-command failure desynchronizes the log from the record.
 */
export class SwishStorage extends Context.Service<SwishStorage, {

	/** Reads the materialized record, absent until the game is initialized. */
	readonly readRecord: <Data>() => Effect.Effect<Data | undefined>;

	/** Reads the genesis record every rebuild without a checkpoint folds from. */
	readonly readBase: <Data>() => Effect.Effect<Data | undefined>;

	/**
	 * Reads one commit by position. Callers stay below `readCommitCount`.
	 * @param index - The commit's position in the log.
	 * @returns The commit, if the log holds one there.
	 */
	readonly readCommit: <Commit>( index: number ) => Effect.Effect<Commit | undefined>;

	/** Reads how many commits the log holds; `0` before anything is committed. */
	readonly readCommitCount: () => Effect.Effect<number>;

	/** Reads the cursor — the newest applied commit, or `-1` when there is none. */
	readonly readCursor: () => Effect.Effect<number>;

	/** Reads the cursor of the commit that started the game, or `-1`. */
	readonly readStartCommitCursor: () => Effect.Effect<number>;

	/** Reads the cursor of the commit that completed the game, or `-1`. */
	readonly readCompletedCommitCursor: () => Effect.Effect<number>;

	/**
	 * Finds the newest checkpoint a rebuild at a cursor may fold from, so a
	 * replay covers a bounded tail of the log rather than the whole game.
	 *
	 * @param cursor - The position being rebuilt at.
	 * @returns The usable checkpoint, if one survives at or before the cursor.
	 */
	readonly nearestCheckpoint: <Data>( cursor: number ) => Effect.Effect<Checkpoint<Data> | undefined>;

	/**
	 * Creates the log: the genesis record as both base and materialized record,
	 * with an empty commit log beneath it.
	 *
	 * @param genesis - The record the game starts from.
	 */
	readonly writeGenesis: <Data>( genesis: Data ) => Effect.Effect<void>;

	/**
	 * Replaces the materialized record without touching the log. Used to heal a
	 * record that has drifted from the cursor.
	 *
	 * @param record - The record to materialize.
	 */
	readonly writeRecord: <Data>( record: Data ) => Effect.Effect<void>;

	/**
	 * Appends a commit at `cursor + 1` and materializes the record it produced.
	 * Committing after an undo therefore forks the history: the count shrinks to
	 * the new commit, stranding whatever sat above it.
	 *
	 * @param write - The commit, the record to stamp, and the markers it sets.
	 * @returns The record as materialized, carrying the version the log assigned.
	 */
	readonly writeCommit: <Data, Commit extends { readonly id: string }>(
		write: CommitWrite<Data, Commit>
	) => Effect.Effect<Data>;

	/**
	 * Travels the log: points the cursor at another commit and materializes the
	 * record rebuilt there. The log itself is left alone, which is what keeps a
	 * redo within reach until a new commit forks it away.
	 *
	 * @param cursor - The commit to move to.
	 * @param record - The record rebuilt at that cursor.
	 */
	readonly moveCursor: <Data>( cursor: number, record: Data ) => Effect.Effect<void>;

	/** Reads the seats the bot policy is playing; empty when nobody handed one over. */
	readonly readAutoPlay: () => Effect.Effect<Record<PlayerId, boolean>>;

	/**
	 * Hands one seat to the bot policy, or takes it back. Outside the log on
	 * purpose: autoplay schedules the game rather than describing it, so it
	 * neither moves the version nor rewinds under undo.
	 *
	 * @param playerId - The seat being switched.
	 * @param enabled - `true` to let the policy play it.
	 */
	readonly writeAutoPlay: ( playerId: PlayerId, enabled: boolean ) => Effect.Effect<void>;

	/** Erases the game: log, record and scheduling facts alike. */
	readonly clear: () => Effect.Effect<void>;

}>()( "swish/Storage" ) {}


/**
 * The cold store for finished games. Once a game completes the engine writes the
 * archived game here, addressed by game and id — what that becomes as a key is
 * the store's business. Game-agnostic: values crossing this boundary are already
 * schema-*encoded* (plain JSON).
 */
export class SwishArchive extends Context.Service<SwishArchive, {

	/**
	 * Files a finished game.
	 * @param address - The game being archived.
	 * @param encoded - The archived game, already schema-encoded.
	 */
	readonly save: ( address: GameAddress, encoded: unknown ) => Effect.Effect<void>;

	/**
	 * Reads a game back out of cold storage.
	 * @param address - The game being read.
	 * @returns The encoded archive, if one was ever filed.
	 */
	readonly load: <T>( address: GameAddress ) => Effect.Effect<Option.Option<T>>;

}>()( "swish/Archive" ) {}


/**
 * Every view one state change produced: the table's, and one per seated player.
 * They always travel together — a push that delivered one without the other
 * would leave half the table a turn behind — so they are one payload rather than
 * two calls the caller has to remember to pair.
 */
export type AudienceViews<View> = {
	readonly table: View;
	readonly players: Record<PlayerId, View>;
};

/**
 * Realtime fan-out. After every state-changing command the engine hands the host
 * a fresh `GameView` per audience; the host pushes each connected client the view
 * for its own audience, and any spectator the table's. Every view carries the
 * same envelope a read returns, so a client decodes one shape however it arrived.
 * Game-agnostic: the payloads are plain JSON-serializable values the engine
 * already computed, so the host never touches game schemas. A no-op layer backs
 * tests / pushless deployments.
 */
export class SwishSync extends Context.Service<SwishSync, {

	/**
	 * Pushes one state change to everyone watching a game.
	 * @param views - The table's view and each player's own.
	 */
	readonly publish: <View>( views: AudienceViews<View> ) => Effect.Effect<void>;

}>()( "swish/Sync" ) {}

/**
 * The kinds of deferred wake-up the engine schedules.
 */
export type AlarmKind = "auto-start" | "bot" | "interaction-timeout" | "move-timeout";

/**
 * The clocks one turn runs under. Every field is optional and absence means "no
 * such clock this turn", so the empty object is a turn nothing is waiting on.
 * - bot: How long until the machine plays the pending seat.
 * - moveTimeout: How long the pending seat has to play for itself.
 * - frameDeadline: When the open interaction frame expires, as an absolute time.
 *
 * A turn arms at most one of `bot` and `moveTimeout` — the seat is either being
 * played for or playing — while `frameDeadline` runs alongside either, since a
 * frame outlives whichever responder is being waited on.
 */
export type TurnTimers = {
	readonly bot?: number;
	readonly moveTimeout?: number;
	readonly frameDeadline?: number;
};

/**
 * Deferred work: multiple named timers, each firing an `AlarmKind`. The host
 * keeps a `kind -> time` map and arms its single wake-up at the earliest pending
 * one; on wake it returns (and clears) the timers now due and re-arms for the
 * next. This lets a bot delay, a reaction deadline and a move clock all run
 * concurrently.
 *
 * The service also owns the *published* deadline, because a move clock is one
 * fact and not two: the alarm that fires it and the countdown the seat's client
 * renders have to be the same instant, so `rearm` derives both from one reading
 * of the clock. It is stored rather than folded — a scheduling fact, not game
 * state — so undo cannot rewind it and a rebuild cannot resurrect a spent one.
 */
export class SwishTimers extends Context.Service<SwishTimers, {

	/**
	 * Replaces the turn's clocks wholesale: whatever `bot`, `move-timeout` and
	 * `interaction-timeout` were pending is dropped, and exactly what the argument
	 * asks for is armed. The published deadline follows the move clock, and a
	 * frame deadline already in the past is not armed — it belongs to a frame on
	 * its way to being settled, and waking at zero would loop the host.
	 *
	 * `auto-start` is left alone: it belongs to a game that has not started, and
	 * this governs one that has.
	 *
	 * @param turn - The clocks this turn runs under. Empty cancels them all.
	 */
	readonly rearm: ( turn: TurnTimers ) => Effect.Effect<void>;

	/**
	 * Arms the delay before a full table starts itself. Outside `rearm` because it
	 * is the one timer that belongs to a game not yet in play.
	 *
	 * @param delayMillis - How long to wait before starting.
	 */
	readonly armAutoStart: ( delayMillis: number ) => Effect.Effect<void>;

	/** Reads when the pending seat's move clock runs out, if one is running. */
	readonly deadline: () => Effect.Effect<number | undefined>;

	/** Drops every pending timer, `auto-start` included. */
	readonly cancelAll: () => Effect.Effect<void>;

	/** Returns the timers now due, clearing them. */
	readonly due: () => Effect.Effect<ReadonlyArray<AlarmKind>>;

}>()( "swish/Timers" ) {}
