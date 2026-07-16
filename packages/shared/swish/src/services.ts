// @s2h/swish/services — the host abstraction boundary.
//
// Every capability the engine needs from its host (durable storage, alarms,
// completed-game archive, the game index, id generation) is declared here as a
// `Context.Service` tag with a pure interface. The engine runtime depends on
// these tags and nothing else — no host imports, no direct storage access. The
// host adapter (added later — e.g. a Cloudflare Durable Object, or an in-memory
// layer for tests) provides the concrete implementations, swappable without
// touching engine logic.
//
// This module is pure: it imports only `effect` and local schema types.

import * as Context from "effect/Context";
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
	readonly load: <T, R = never>() => Effect.Effect<Option.Option<NonNullable<T>>, never, R>;
	readonly save: <T, R = never>( encoded: T ) => Effect.Effect<void, never, R>;
	readonly clear: <R = never>() => Effect.Effect<void, never, R>;
}>()( "swish/GameStore" ) {}

/**
 * Deferred work: multiple named timers, each firing an `AlarmKind`. The host
 * keeps a `key -> { at, alarm }` map and arms its single wake-up at the earliest
 * pending time; on wake it returns (and clears) the timers now due and re-arms
 * for the next. This lets a bot delay, a reaction deadline, and a move clock all
 * run concurrently. `cancel(key)` drops one timer; `cancelAll` drops them all.
 */
export class Scheduler extends Context.Service<Scheduler, {
	readonly schedule: ( key: string, delayMillis: number, alarm: AlarmKind ) => Effect.Effect<void>;
	readonly cancel: ( key: string ) => Effect.Effect<void>;
	readonly cancelAll: Effect.Effect<void>;
	readonly due: Effect.Effect<ReadonlyArray<AlarmKind>>;
}>()( "swish/Scheduler" ) {}

/** Archive for completed games (shared view + per-player views). */
export class GameArchive extends Context.Service<GameArchive, {
	readonly put: ( key: string, encoded: unknown ) => Effect.Effect<void>;
	readonly get: ( key: string ) => Effect.Effect<Option.Option<unknown>>;
}>()( "swish/GameArchive" ) {}

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
	readonly setBase: ( encoded: unknown ) => Effect.Effect<void>;
	readonly append: ( commit: unknown ) => Effect.Effect<void>;
	readonly moveCursor: ( delta: 1 | -1 ) => Effect.Effect<Option.Option<unknown>>;
	readonly read: Effect.Effect<EventLog>;
}>()( "swish/EventStore" ) {}
