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
import type { InteractionOpened, SeatStatusChanged } from "./events";
import type {
	Audience,
	BaseGameConfig,
	GameContext,
	GameSnapshot,
	InteractionFrame,
	PlayerId,
	Players,
	Standings
} from "./schema";

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
export type BaseMoveInputs = Record<string, Schema.Top>;

export type BotMove<MoveInputs extends BaseMoveInputs> = {
	readonly [K in keyof MoveInputs]: {
		readonly moveType: K;
		readonly input: MoveInputs[K]["Type"]
	}
}[keyof MoveInputs]

export type GameStructure<
	Name extends string,
	State,
	Config extends BaseGameConfig,
	MoveInputs extends BaseMoveInputs,
	PhaseMoves extends Record<string, ReadonlyArray<keyof MoveInputs>>,
	Events extends { readonly _tag: string },
	View
> = {
	readonly name: Name;

	/**
	 * Persisted-state schema version (default 1). Bump it when the `state` shape
	 * changes and add a `migrations` entry so records persisted before the deploy
	 * still load (Monopoly-length games span deploys).
	 */
	readonly version?: number;

	/**
	 * Migrations keyed by the version they upgrade FROM, each producing the next
	 * version's raw (pre-decode) record. Applied in sequence in `load`/`refold`
	 * before schema decoding, so an old on-disk shape is repaired before it must
	 * match the current schema.
	 */
	readonly migrations?: Record<number, ( old: unknown ) => unknown>;

	/**
	 * Upcaster for a single persisted event, applied before each logged commit is
	 * decoded during `refold` — lets old event shapes in the append-only log still
	 * fold after an event-schema change. Return the raw event unchanged if N/A.
	 */
	readonly upcastEvent?: ( raw: unknown ) => unknown;

	readonly schemas: {
		readonly state: Schema.Codec<State, unknown>;
		readonly config: Schema.Codec<Config, unknown>;
		readonly events: Schema.Codec<Events, unknown>;
		readonly views: {
			readonly view: Schema.Codec<View, unknown>;
		};
		readonly moves: {
			[K in keyof MoveInputs]: MoveInputs[K];
		}
	};

	readonly setup: ( config: Config ) => State;
	readonly apply: ( state: State, event: Events ) => State;
	readonly endIf: ( data: ReadonlyGameData<State, Config> ) => boolean;

	/**
	 * Canonical standings computed on completion (#12), stored on the archived
	 * `CompletedGameData` so UIs render placement without re-deriving it. Optional.
	 */
	readonly resolveResults?: ( data: ReadonlyGameData<State, Config> ) => Standings;

	/**
	 * Map a domain event to a human-readable action-feed line (#11), or undefined
	 * to omit it. The engine supplies the commit's timestamp/actor; this returns
	 * just the text. Receives the `audience` so hidden info can be redacted per
	 * recipient (never name a card an opponent should not see).
	 */
	readonly describe?: (
		event: Events,
		players: Players,
		config: Config,
		audience: Audience
	) => string | undefined;

	/**
	 * The single, audience-parameterised projection. For a `Table` audience it
	 * returns the public board; for a `Player` audience it returns the public
	 * board plus that player's private slice. Replaces the old sharedView +
	 * playerView pair.
	 */
	readonly view: ( data: ReadonlyGameData<State, Config>, audience: Audience ) => View;

	readonly hooks: {
		readonly onJoin?: (
			data: ReadonlyGameData<State, Config>,
			playerId: PlayerId
		) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;

		readonly onStart?: ( data: ReadonlyGameData<State, Config> ) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;

		readonly beforeMove?: (
			data: ReadonlyGameData<State, Config>,
			playerId: PlayerId,
			moveType: string
		) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;

		readonly afterMove?: (
			data: ReadonlyGameData<State, Config>,
			playerId: PlayerId,
			moveType: string
		) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;

		readonly onEnd?: ( data: ReadonlyGameData<State, Config> ) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;
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
			) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;

			/**
			 * Whether this move ends the acting player's turn (default `true`). When
			 * `false` the engine keeps `currentPlayer` and does not advance the turn
			 * or resolve the next player — for games where one turn is many actions
			 * (Monopoly: roll → move → buy → … → end turn). `endIf`/game-completion
			 * still runs.
			 */
			readonly endsTurn?: boolean | ( (
				data: ReadonlyGameData<State, Config>,
				playerId: PlayerId,
				input: MoveInputs[K]["Type"]
			) => boolean );

			/**
			 * Config-driven capability gate (#8). When present and it returns false
			 * for the game's config, the engine rejects the move centrally — so a
			 * variant/house-rule toggle (e.g. Uno `stacking`, `jumpIn`) disables a
			 * move without each `validate` re-checking. Absent ⇒ always enabled.
			 */
			readonly enabledWhen?: ( config: Config ) => boolean;
		};
	};

	/**
	 * Opt-in reaction / interaction windows, keyed by `kind`. A move opens one by
	 * emitting `openInteraction(frame)` from its `execute`; while the frame is the
	 * active (top-of-stack) interaction the engine routes the `responseMoves` to
	 * the frame's responders (instead of `currentPlayer`) and suppresses turn
	 * advancement. When the frame `isComplete`, `resolve` runs and may emit its
	 * effects plus a nested `openInteraction` (a stack — e.g. "Just Say No" on
	 * "Just Say No"). Games that never open an interaction omit this entirely.
	 */
	readonly interactions?: {
		readonly [ kind: string ]: {
			// Moves that count as responses while this frame is active.
			readonly responseMoves: ReadonlyArray<keyof MoveInputs>;
			// May this player respond now? Defaults per `mode` (sequential: the next
			// responder in order; simultaneous: any responder not yet answered).
			readonly canRespond?: (
				data: ReadonlyGameData<State, Config>,
				frame: InteractionFrame,
				playerId: PlayerId
			) => boolean;
			// Enough responses in to resolve? Defaults to "all responders answered".
			readonly isComplete?: (
				data: ReadonlyGameData<State, Config>,
				frame: InteractionFrame
			) => boolean;
			// Resolve the window: emit game effects, optionally a nested interaction.
			readonly resolve: (
				data: ReadonlyGameData<State, Config>,
				frame: InteractionFrame
			) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;
		};
	};

	readonly botMove?: ( data: GameSnapshot<View, Config> ) => BotMove<MoveInputs> | undefined;

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
			readonly onEnter?: ( data: ReadonlyGameData<State, Config> ) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;
			readonly onExit?: ( data: ReadonlyGameData<State, Config> ) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;
			readonly resolveNextPhase: ( data: ReadonlyGameData<State, Config> ) => keyof PhaseMoves;
			readonly resolveNextPlayer?: (
				data: ReadonlyGameData<State, Config>,
				playerId: PlayerId,
				moveType: string
			) => PlayerId;
		}
	};
}
