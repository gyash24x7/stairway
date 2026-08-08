import * as Context from "effect/Context";
import type * as Alchemy from "alchemy";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

/** The kinds of deferred wake-up the engine schedules. */
export type AlarmKind = "auto-start" | "bot" | "interaction-timeout" | "move-timeout";

/**
 * Durable, single-key game state. Values crossing this boundary are already
 * schema-*encoded* (plain JSON) — the engine owns encode/decode so the store
 * stays game-agnostic.
 */
export class GameStore extends Context.Service<GameStore, {
	readonly load: <T>() => Effect.Effect<Option.Option<T>, never, Alchemy.RuntimeContext>;
	readonly save: <T>( encoded: T ) => Effect.Effect<void, never, Alchemy.RuntimeContext>;
	readonly clear: () => Effect.Effect<void, never, Alchemy.RuntimeContext>;
}>()( "swish/GameStore" ) {}

/**
 * Deferred work: multiple named timers, each firing an `AlarmKind`. The host
 * keeps a `key -> alarm` map and arms its single wake-up at the earliest pending
 * time; on wake it returns (and clears) the timers now due and re-arms for the
 * next. This lets a bot delay, a reaction deadline, and a move clock all run
 * concurrently. `cancel(key)` drops one timer; `cancelAll` drops them all.
 */
export class Scheduler extends Context.Service<Scheduler, {
	readonly schedule: ( key: string, delayMillis: number, alarm: AlarmKind ) =>
		Effect.Effect<void, never, Alchemy.RuntimeContext>;
	readonly cancel: ( key: string ) => Effect.Effect<void, never, Alchemy.RuntimeContext>;
	readonly cancelAll: () => Effect.Effect<void, never, Alchemy.RuntimeContext>;
	readonly due: () => Effect.Effect<ReadonlyArray<AlarmKind>, never, Alchemy.RuntimeContext>;
}>()( "swish/Scheduler" ) {}

/**
 * Realtime fan-out. After every state-changing command the engine hands the host
 * the fresh per-audience snapshots (`table` + one per player) for a `channel`
 * (the game's `${name}:${id}`); the host pushes each connected client the
 * snapshot for its own audience. Game-agnostic: the payloads are already-plain
 * (JSON-serializable) `GameSnapshot`s the engine computed, so the host never
 * touches game schemas. A no-op layer backs tests / pushless deployments.
 */
export class Sync extends Context.Service<Sync, {
	readonly broadcast: (
		channel: string,
		snapshot: { readonly table: unknown; readonly playerViews: Record<string, unknown> }
	) => Effect.Effect<void>;
}>()( "swish/Sync" ) {}

/** The persisted shape of the event log: a genesis snapshot + ordered commits. */
export interface EventLog {
	readonly base: unknown;
	readonly commits: ReadonlyArray<unknown>;
	readonly cursor: number;
}

/**
 * The append-only event log — the write model / history that makes a game
 * replayable and undoable. Game-agnostic: it stores schema-*encoded* commits
 * (plain JSON); the engine owns encode/decode. Backed by durable storage on the
 * host; an in-memory layer backs tests.
 */
export class EventStore extends Context.Service<EventStore, {
	readonly setBase: ( encoded: unknown ) => Effect.Effect<void, never, Alchemy.RuntimeContext>;
	readonly append: ( commit: unknown ) => Effect.Effect<void, never, Alchemy.RuntimeContext>;
	readonly moveCursor: ( delta: 1 | -1 ) => Effect.Effect<Option.Option<unknown>, never, Alchemy.RuntimeContext>;
	readonly read: () => Effect.Effect<EventLog, never, Alchemy.RuntimeContext>;
}>()( "swish/EventStore" ) {}

/**
 * The cold store for finished games. Once a game completes the engine writes its
 * `CompletedGameData` here under `${gameName}:${gameId}`, so the final board and
 * standings outlive the Durable Object that produced them. Game-agnostic: values
 * crossing this boundary are already schema-*encoded* (plain JSON).
 *
 * `remove` exists because completion is derived from the log cursor, not a
 * one-way door: an `undo` past the finish un-completes the game, and the archive
 * has to follow it back.
 */
export class GameArchive extends Context.Service<GameArchive, {
	readonly save: ( key: string, encoded: unknown ) =>
		Effect.Effect<void, never, Alchemy.RuntimeContext>;

	readonly load: ( key: string ) =>
		Effect.Effect<Option.Option<unknown>, never, Alchemy.RuntimeContext>;

	readonly remove: ( key: string ) => Effect.Effect<void, never, Alchemy.RuntimeContext>;
}>()( "swish/GameArchive" ) {}

