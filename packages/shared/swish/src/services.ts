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

/** The two kinds of deferred wake-up the engine schedules. */
export type AlarmKind = "auto-start" | "bot";

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
 * Deferred work: schedule/cancel a future wake-up and record which kind it is
 * (auto-start vs. bot move). Backed by a host timer/alarm.
 */
export class Scheduler extends Context.Service<Scheduler, {
	readonly schedule: ( delayMillis: number, alarm: AlarmKind ) => Effect.Effect<void>;
	readonly cancel: Effect.Effect<void>;
	readonly read: Effect.Effect<Option.Option<AlarmKind>>;
}>()( "swish/Scheduler" ) {}

/** Archive for completed games (shared view + per-player views). */
export class GameArchive extends Context.Service<GameArchive, {
	readonly put: ( key: string, encoded: unknown ) => Effect.Effect<void>;
	readonly get: ( key: string ) => Effect.Effect<Option.Option<unknown>>;
}>()( "swish/GameArchive" ) {}

/** The persisted shape of the event log: a genesis snapshot + ordered commits. */
export interface EventLog {
	/** Encoded genesis `PersistedGameData` — the base of every replay. */
	readonly base: unknown;
	/** Encoded commits, append order. `commits.slice(0, cursor + 1)` is applied. */
	readonly commits: ReadonlyArray<unknown>;
	/** Index of the last applied commit; `-1` means only the genesis. */
	readonly cursor: number;
}

/**
 * The append-only event log — the write model / history that makes a game
 * replayable and undoable. Game-agnostic: it stores schema-*encoded* commits
 * (plain JSON); the engine owns encode/decode. Backed by durable storage on the
 * host; an in-memory layer backs tests.
 */
export class EventStore extends Context.Service<EventStore, {
	/** Record the genesis snapshot (once, at `initialize`). Resets the log. */
	readonly setBase: ( encoded: unknown ) => Effect.Effect<void>;
	/** Append a commit: drop any redo tail after the cursor, push, advance cursor. */
	readonly append: ( commit: unknown ) => Effect.Effect<void>;
	/** Move the cursor by ±1 (undo/redo); returns the moved-over commit, or None. */
	readonly moveCursor: ( delta: 1 | -1 ) => Effect.Effect<Option.Option<unknown>>;
	/** The full log state (for replay/refold). */
	readonly read: Effect.Effect<EventLog>;
}>()( "swish/EventStore" ) {}
