// @s2h/swish/structure — the game-authoring API.
//
// Pure / browser-safe. A game is a declarative `GameStructure`: schemas for its
// data + events, plus effectful lifecycle functions. Under event sourcing, the
// deciders (`execute`/hooks) no longer return the next `State` — they **emit
// domain events** (`Ev`), and the game supplies a pure `apply(state, event)`
// reducer that is the only place `state` changes. `R` is the union of services
// a game's functions require (usually `never`). Nondeterminism (Random/Clock)
// lives in the deciders and is captured in the emitted events, so replay is
// deterministic — `apply` must stay pure.

import type * as Effect from "effect/Effect";
import type * as Schema from "effect/Schema";
import type { InvalidMove } from "./errors";
import type { BaseGameConfig, GameContext, PlayerId } from "./schema";

/** The read-only snapshot passed into every game function. */
export type ReadonlyGameData<State, Config> = {
	readonly state: State;
	readonly config: Config;
	readonly context: GameContext;
}

/** A single move: its payload schema + effectful validate/canMove + event-emitting execute. */
export type Move<State, Config, Ev, In extends Schema.Top, R> = {
	/** Effect Schema for the move payload; also the wire schema of its RPC. */
	readonly input: In;
	/** Optional custom permission check; absent ⇒ engine enforces turn order. */
	readonly canMove?: (
		data: ReadonlyGameData<State, Config>,
		playerId: PlayerId
	) => Effect.Effect<boolean, never, R>;
	/** Reject bad input with `InvalidMove`. Runs before `execute`; emits nothing. */
	readonly validate: (
		data: ReadonlyGameData<State, Config>,
		playerId: PlayerId,
		input: In[ "Type" ]
	) => Effect.Effect<void, InvalidMove, R>;
	/** Emit the domain events this move produces. Assumes input already validated. */
	readonly execute: (
		data: ReadonlyGameData<State, Config>,
		playerId: PlayerId,
		input: In[ "Type" ]
	) => Effect.Effect<ReadonlyArray<Ev>, never, R>;
}

/** A named map of moves. Instantiated with a literal to preserve input types. */
export type MoveMap<State, Config, Ev, R> = Record<string, Move<State, Config, Ev, any, R>>;

/** Chooses who plays next after a move (or after a phase ends). */
export type ResolveNextPlayer<State, Config, R> = (
	data: ReadonlyGameData<State, Config>,
	playerId: PlayerId,
	moveType: string
) => Effect.Effect<PlayerId, never, R>;

/** Chooses a bot's move from the bot's merged (shared + own) view. */
export type BotMove<
	State,
	Config extends BaseGameConfig,
	Ev,
	M extends MoveMap<State, Config, Ev, R>,
	MoveType extends keyof M,
	View,
	R
> = (
	data: ReadonlyGameData<View, Config>
) => Effect.Effect<{
	readonly moveType: MoveType;
	readonly input: Schema.Schema.Type<M[MoveType]["input"]>
}, never, R>;

/** Lifecycle hooks; each emits domain events (folded onto `state`). */
export type GameHooks<State, Config, Ev, R> = {
	readonly onJoin?: (
		data: ReadonlyGameData<State, Config>,
		playerId: PlayerId
	) => Effect.Effect<ReadonlyArray<Ev>, never, R>;
	readonly onStart?: ( data: ReadonlyGameData<State, Config> ) => Effect.Effect<ReadonlyArray<Ev>, never, R>;
	readonly beforeMove?: (
		data: ReadonlyGameData<State, Config>,
		playerId: PlayerId,
		moveType: string
	) => Effect.Effect<ReadonlyArray<Ev>, never, R>;
	readonly afterMove?: (
		data: ReadonlyGameData<State, Config>,
		playerId: PlayerId,
		moveType: string
	) => Effect.Effect<ReadonlyArray<Ev>, never, R>;
	readonly onEnd?: ( data: ReadonlyGameData<State, Config> ) => Effect.Effect<ReadonlyArray<Ev>, never, R>;
}

/** One phase of a phased game: its own moves + transition rules. */
export type GamePhase<
	State,
	Config extends BaseGameConfig,
	Ev,
	M extends MoveMap<State, Config, Ev, R>,
	SV,
	PV,
	R
> = {
	readonly moves: M;
	readonly resolveNextPlayer: ResolveNextPlayer<State, Config, R>;
	readonly endIf: ( data: ReadonlyGameData<State, Config> ) => Effect.Effect<boolean, never, R>;
	readonly resolveNextPhase: ( data: ReadonlyGameData<State, Config> ) => Effect.Effect<string, never, R>;
	readonly onEnter?: ( data: ReadonlyGameData<State, Config> ) => Effect.Effect<ReadonlyArray<Ev>, never, R>;
	readonly onExit?: ( data: ReadonlyGameData<State, Config> ) => Effect.Effect<ReadonlyArray<Ev>, never, R>;
	readonly resolveStartingPlayer?: ( data: ReadonlyGameData<State, Config> ) => Effect.Effect<PlayerId, never, R>;
	readonly botMove?: BotMove<State, Config, Ev, M, keyof M, SV & PV, R>;
	readonly hooks?: Pick<GameHooks<State, Config, Ev, R>, "beforeMove" | "afterMove">;
}

/** Fields shared by flat and phased structures. */
interface BaseGameStructure<State, Config extends BaseGameConfig, Ev, SV, PV, R> {
	readonly name: string;
	// `Codec<T, unknown, never, never>`, not `Schema<T>` or `Codec<T>`:
	//  - `Schema.Schema<T>` inherits `DecodingServices = unknown` from `Top`, which
	//    would poison `decode`/`encode` Effects with an `unknown` requirement.
	//  - `Codec<T>` defaults `Encoded = T`, forcing `Encoded === Type` — false for
	//    branded/tagged schemas, which silently drops the brand/tag from types.
	// The explicit form pins decode/encode services to `never` while leaving
	// `Encoded` free, so `T` is inferred as the schema's real (branded) `Type`.
	readonly stateSchema: Schema.Codec<State, unknown, never, never>;
	readonly configSchema: Schema.Codec<Config, unknown, never, never>;
	readonly sharedViewSchema: Schema.Codec<SV, unknown, never, never>;
	readonly playerViewSchema: Schema.Codec<PV, unknown, never, never>;
	/** The game's domain-event union — stored in the log and replayed. */
	readonly eventSchema: Schema.Codec<Ev, unknown, never, never>;
	/** Pure reducer: fold one domain event onto `state`. NO Effect, NO Random. */
	readonly apply: ( state: State, event: Ev ) => State;
	readonly setup: ( config: Config ) => Effect.Effect<State, never, R>;
	readonly endIf: ( data: ReadonlyGameData<State, Config> ) => Effect.Effect<boolean, never, R>;
	readonly sharedView: ( data: ReadonlyGameData<State, Config> ) => Effect.Effect<SV, never, R>;
	readonly playerView: (
		data: ReadonlyGameData<State, Config>,
		playerId: PlayerId
	) => Effect.Effect<PV, never, R>;
	readonly hooks?: GameHooks<State, Config, Ev, R>;
}

/** A single unphased rule set (wordle/tic-tac-toe shape). */
export interface FlatGameStructure<State, Config extends BaseGameConfig, Ev, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>
	extends BaseGameStructure<State, Config, Ev, SV, PV, R> {
	readonly moves: M;
	readonly resolveNextPlayer: ResolveNextPlayer<State, Config, R>;
	readonly botMove?: BotMove<State, Config, Ev, M, keyof M, SV & PV, R>;
	readonly phases?: undefined;
	readonly initialPhase?: undefined;
}

/** A map of phases with an entry point (fish/literature shape). */
export interface PhasedGameStructure<State, Config extends BaseGameConfig, Ev, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>
	extends BaseGameStructure<State, Config, Ev, SV, PV, R> {
	readonly phases: Record<string, GamePhase<State, Config, Ev, M, SV, PV, R>>;
	readonly initialPhase: string;
	readonly moves?: undefined;
	readonly resolveNextPlayer?: undefined;
	readonly botMove?: undefined;
}

export type GameStructure<State, Config extends BaseGameConfig, Ev, M extends MoveMap<State, Config, Ev, R>, SV, PV, R = never> =
	| FlatGameStructure<State, Config, Ev, M, SV, PV, R>
	| PhasedGameStructure<State, Config, Ev, M, SV, PV, R>;

/**
 * Identity helper that infers `State/Config/Ev/M/SV/PV/R` from a flat structure.
 * Keeping the literal type of `moves` is what lets a game declare a typed RPC
 * per move (via `EngineRpc.makeForMove`) and wire it to `Engine.submitMove`.
 */
export const defineGame = <State, Config extends BaseGameConfig, Ev, M extends MoveMap<State, Config, Ev, R>, SV, PV, R = never>(
	structure: FlatGameStructure<State, Config, Ev, M, SV, PV, R>
): FlatGameStructure<State, Config, Ev, M, SV, PV, R> => structure;

/** As `defineGame`, for phased structures. */
export const definePhasedGame = <State, Config extends BaseGameConfig, Ev, M extends MoveMap<State, Config, Ev, R>, SV, PV, R = never>(
	structure: PhasedGameStructure<State, Config, Ev, M, SV, PV, R>
): PhasedGameStructure<State, Config, Ev, M, SV, PV, R> => structure;
