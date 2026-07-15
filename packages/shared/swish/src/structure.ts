// @s2h/swish/structure — the game-authoring API.
//
// Pure / browser-safe. A game is a declarative `NewGameStructure`: schemas for
// its data + events, plus lifecycle functions. Under event sourcing, the deciders
// (`execute`/hooks) do not return the next `State` — they **emit domain events**
// (`Events`), and the game supplies a pure `apply(state, event)` reducer that is
// the only place `state` changes. Authoring is synchronous: `setup`/`apply`/
// `endIf`/views/hooks/`execute`/`resolveNextPlayer` return plain values or event
// arrays; only a move's `validate` is an `Effect` (it can fail with `InvalidMove`).
// Nondeterminism (e.g. random setup) is captured in the emitted/genesis state, so
// replay is deterministic — `apply` must stay pure.

import type { Rng } from "@s2h/utils/rng";
import type * as Schema from "effect/Schema";
import type { InvalidMove } from "./errors";
import type { BaseGameConfig, GameContext, GameSnapshot, PlayerId } from "./schema";

/** The read-only snapshot passed into every game function. */
export type ReadonlyGameData<State, Config> = {
	readonly state: State;
	readonly config: Config;
	readonly context: GameContext;
	/**
	 * A deterministic PRNG for deciders. Seeded from the game's server-only seed
	 * plus the current turn plus the decider's role, so it is a pure function of
	 * persisted state (replay-exact). Pass a `salt` to draw independent streams
	 * within one decider. Outputs must still be captured in emitted events.
	 */
	readonly rng: ( salt?: string ) => Rng;
}

/** A named map of move-name -> payload schema; instantiated with a literal to preserve input types. */
export type BaseMoveInputs<I = unknown> = Record<string, Schema.Codec<I, unknown>>;

export type GameStructure<
	Name extends string,
	State,
	Config extends BaseGameConfig,
	MoveInputs extends BaseMoveInputs,
	PhaseMoves extends Record<string, ReadonlyArray<keyof MoveInputs>>,
	Events extends { readonly _tag: string },
	SharedView,
	PlayerView
> = {
	readonly name: Name;
	readonly schemas: {
		readonly state: Schema.Codec<State, unknown>;
		readonly config: Schema.Codec<Config, unknown>;
		readonly events: Schema.Codec<Events, unknown>;
		readonly views: {
			readonly shared: Schema.Codec<SharedView, unknown>;
			readonly player: Schema.Codec<PlayerView, unknown>;
		};
		readonly moves: {
			[K in keyof MoveInputs]: MoveInputs[K];
		}
	};

	readonly setup: ( config: Config ) => State;
	readonly apply: ( state: State, event: Events ) => State;
	readonly endIf: ( data: ReadonlyGameData<State, Config> ) => boolean;
	readonly sharedView: ( data: ReadonlyGameData<State, Config> ) => SharedView;
	readonly playerView: ( data: ReadonlyGameData<State, Config>, playerId: PlayerId ) => PlayerView;

	readonly hooks: {
		readonly onJoin?: (
			data: ReadonlyGameData<State, Config>,
			playerId: PlayerId
		) => ReadonlyArray<Events>;

		readonly onStart?: ( data: ReadonlyGameData<State, Config> ) => ReadonlyArray<Events>;

		readonly beforeMove?: (
			data: ReadonlyGameData<State, Config>,
			playerId: PlayerId,
			moveType: string
		) => ReadonlyArray<Events>;

		readonly afterMove?: (
			data: ReadonlyGameData<State, Config>,
			playerId: PlayerId,
			moveType: string
		) => ReadonlyArray<Events>;

		readonly onEnd?: ( data: ReadonlyGameData<State, Config> ) => ReadonlyArray<Events>;
	};

	readonly moves: {
		[K in keyof MoveInputs]: {
			readonly phase?: keyof PhaseMoves;
			readonly canMove?: ( data: ReadonlyGameData<State, Config>, playerId: PlayerId ) => boolean;

			readonly validate: (
				data: ReadonlyGameData<State, Config>,
				playerId: PlayerId,
				input: MoveInputs[K]["Type"]
			) => InvalidMove | undefined;

			readonly execute: (
				data: ReadonlyGameData<State, Config>,
				playerId: PlayerId,
				input: MoveInputs[K]["Type"]
			) => ReadonlyArray<Events>;
		};
	};

	readonly botMove?: ( data: GameSnapshot<SharedView, PlayerView, Config> ) => {
		readonly [K in keyof MoveInputs]: {
			readonly moveType: K;
			readonly input: MoveInputs[K]["Type"]
		}
	}[keyof MoveInputs];

	readonly resolveNextPlayer?: (
		data: ReadonlyGameData<State, Config>,
		playerId: PlayerId,
		moveType: string
	) => PlayerId;

	readonly initialPhase?: keyof PhaseMoves;
	readonly phases?: {
		[K in keyof PhaseMoves]: {
			readonly moves: PhaseMoves[K];
			readonly endIf: ( data: ReadonlyGameData<State, Config> ) => boolean;
			readonly resolveStartingPlayer?: ( data: ReadonlyGameData<State, Config> ) => PlayerId;
			readonly onEnter?: ( data: ReadonlyGameData<State, Config> ) => ReadonlyArray<Events>;
			readonly onExit?: ( data: ReadonlyGameData<State, Config> ) => ReadonlyArray<Events>;
			readonly resolveNextPhase: ( data: ReadonlyGameData<State, Config> ) => keyof PhaseMoves;
			readonly resolveNextPlayer?: (
				data: ReadonlyGameData<State, Config>,
				playerId: PlayerId,
				moveType: string
			) => PlayerId;
		}
	};
}
