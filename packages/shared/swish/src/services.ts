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

import { Context, type Effect, type Option } from "effect";
import type { GameCode, GameId } from "./schema";

/** The two kinds of deferred wake-up the engine schedules. */
export type AlarmKind = "auto-start" | "bot";

/** A row in the game index. */
export interface GameRow {
	readonly id: GameId;
	readonly code: GameCode;
	readonly game: string;
	readonly completed: 0 | 1;
	readonly createdAt: number;
}

/** A freshly-minted bot identity. */
export interface BotIdentity {
	readonly id: string;
	readonly name: string;
	readonly avatar: string;
}

/**
 * Durable, single-key game state. Values crossing this boundary are already
 * schema-*encoded* (plain JSON) — the engine owns encode/decode so the store
 * stays game-agnostic.
 */
export class GameStore extends Context.Service<GameStore, {
	readonly load: Effect.Effect<Option.Option<unknown>>;
	readonly save: ( encoded: unknown ) => Effect.Effect<void>;
	readonly clear: Effect.Effect<void>;
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

/** The game index: lookup by id/code, completion marking, stale cleanup. */
export class GameRepo extends Context.Service<GameRepo, {
	readonly create: ( game: string ) => Effect.Effect<GameRow>;
	readonly byId: ( game: string, id: GameId ) => Effect.Effect<Option.Option<GameRow>>;
	readonly byCode: ( game: string, code: GameCode ) => Effect.Effect<Option.Option<GameRow>>;
	readonly markCompleted: ( id: GameId ) => Effect.Effect<void>;
	readonly listStale: ( olderThanSeconds: number ) => Effect.Effect<ReadonlyArray<GameRow>>;
	readonly remove: ( ids: ReadonlyArray<GameId> ) => Effect.Effect<void>;
}>()( "swish/GameRepo" ) {}

/** Id / code / avatar / bot generation. Wraps `@s2h/utils/generator`. */
export class Ids extends Context.Service<Ids, {
	readonly gameId: Effect.Effect<GameId>;
	readonly code: Effect.Effect<GameCode>;
	readonly avatar: Effect.Effect<string>;
	readonly botIdentity: Effect.Effect<BotIdentity>;
}>()( "swish/Ids" ) {}
