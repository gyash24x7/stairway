import type * as Schema from "effect/Schema";

import type {
	Audience,
	BaseGameConfig,
	GameContext,
	GameSnapshot,
	InteractionFrame,
	PlayerId,
	Players,
	Standings
} from "@/shared/swish/schema.ts";
import type { Rng } from "@/shared/utils/rng.ts";
import type { InvalidMove } from "@/shared/swish/errors.ts";
import type { InteractionOpened, SeatStatusChanged } from "@/shared/swish/events.ts";

/**
 * The read-only snapshot passed into every game function. Game code reads from it
 * but never mutates it — all change flows through emitted events.
 */
export type ReadonlyGameData<State, Config> = {
	/** The game-owned state (opaque to the engine). */
	readonly state: State;

	/** The immutable game config supplied at creation. */
	readonly config: Config;

	/** The engine envelope: turn, current player, phase, interaction stack, seats. */
	readonly context: GameContext;

	/**
	 * A deterministic RNG factory. Folds the game seed, current turn, the call
	 * site's role, and the given `salt` into an independent stream, so two draws in
	 * the same turn never collide.
	 *
	 * @param [salt] - Disambiguates this draw from others in the same turn/role.
	 * @returns The seeded RNG.
	 */
	readonly rng: ( salt?: string ) => Rng;
}

/**
 * A named map of move-name -> payload schema;
 * instantiated with a literal to preserve input types.
 */
export type BaseMoveInputs = Record<string, Schema.Top>;

/**
 * A discriminated union of a game's moves as `{ moveType, input }` pairs — the
 * shape a `botMove` policy returns and the engine submits on the bot's behalf.
 */
export type BotMove<MoveInputs extends BaseMoveInputs> = {
	readonly [K in keyof MoveInputs]: {
		readonly moveType: K;
		readonly input: MoveInputs[K]["Type"]
	}
}[keyof MoveInputs]

/**
 * The complete, declarative contract a game hands to `makeEngine`. It carries the
 * game's `schemas` (state/config/events/view/moves — driving persistence and the
 * generated API), the core reducers (`setup`, `apply`, `view`, `endIf`), the
 * per-move rules (`validate`/`execute` with optional `canMove`/`endsTurn`/
 * `enabledWhen`/`phase`), and the opt-in extensions: lifecycle `hooks`, `phases`,
 * reaction `interactions`, `botMove`, custom turn/next-player/next-phase
 * resolution, and `resolveResults`/`describe`. The engine reads this structure and
 * nothing else about the game, so every field here is the seam between the generic
 * runtime and one game's rules.
 *
 * @typeParam Name - The game's unique name (channel/archive key prefix).
 * @typeParam State - The game-owned state shape (opaque to the engine).
 * @typeParam Config - The game config, extending `BaseGameConfig`.
 * @typeParam MoveInputs - Map of move name → input schema.
 * @typeParam PhaseMoves - Map of phase name → the move names legal in it.
 * @typeParam Events - The game's domain event union.
 * @typeParam View - The audience-parameterised projection returned by `view`.
 */
export type GameStructure<
	Name extends string,
	State,
	Config extends BaseGameConfig,
	MoveInputs extends BaseMoveInputs,
	PhaseMoves extends Record<string, ReadonlyArray<keyof MoveInputs>>,
	Events extends { readonly _tag: string },
	View
> = {
	/** The game's unique name; used as the channel and archive key prefix. */
	readonly name: Name;

	/**
	 * The game's schemas. They drive persistence (encode/decode of the log and
	 * snapshot) and the generated API/RPC surface — the engine holds no other
	 * knowledge of the game's shapes.
	 */
	readonly schemas: {
		/** Codec for the game-owned `state`. */
		readonly state: Schema.Codec<State, unknown>;

		/** Codec for the game `config`. */
		readonly config: Schema.Codec<Config, unknown>;

		/** Codec for the game's domain event union (stored in the log). */
		readonly events: Schema.Codec<Events, unknown>;

		/** Codec for the audience-parameterised `view` (sent to clients). */
		readonly view: Schema.Codec<View, unknown>;

		/** Per-move input schemas, keyed by move name; typed with a literal to preserve input types. */
		readonly moves: {
			[K in keyof MoveInputs]: MoveInputs[K];
		}
	};

	/**
	 * Builds the genesis state for a fresh game from its config. Pure.
	 *
	 * @param config - The game config supplied at creation.
	 * @returns The initial game state.
	 */
	readonly setup: ( config: Config ) => State;

	/**
	 * The pure reducer for game (domain) events — the only function that changes
	 * `state`. Engine events never reach it; they patch the envelope instead.
	 *
	 * @param state - The current state.
	 * @param event - The game event to apply.
	 * @returns The next state.
	 */
	readonly apply: ( state: State, event: Events ) => State;

	/**
	 * Whether the game is over. Evaluated after every move's tail; when `true` the
	 * engine runs `onEnd`, emits `GameCompleted`, and archives.
	 *
	 * @param data - The current read-only snapshot.
	 * @returns `true` when the game has ended.
	 */
	readonly endIf: ( data: ReadonlyGameData<State, Config> ) => boolean;

	/**
	 * Canonical standings computed on completion and stored on the archived
	 * `CompletedGameData` so UIs render placement without re-deriving it. Optional.
	 *
	 * @param data - The completed game's read-only snapshot.
	 * @returns The final ranking (and optional winner).
	 */
	readonly resolveResults?: ( data: ReadonlyGameData<State, Config> ) => Standings;

	/**
	 * Maps a domain event to a human-readable action-feed line, or `undefined` to
	 * omit it. The engine supplies the commit's timestamp/actor; this returns just
	 * the text. Receives the `audience` so hidden info can be redacted per recipient
	 * (never name a card an opponent should not see).
	 *
	 * @param event - The domain event to describe.
	 * @param players - The roster, for resolving names.
	 * @param config - The game config.
	 * @param audience - Who the line is rendered for (drives redaction).
	 * @returns The feed line, or `undefined` to omit this event.
	 */
	readonly describe?: (
		event: Events,
		players: Players,
		config: Config,
		audience: Audience
	) => string | undefined;

	/**
	 * The single, audience-parameterised projection. For a `Table` audience it
	 * returns the public board; for a `Player` audience it returns the public board
	 * plus that player's private slice. Replaces the old sharedView + playerView pair.
	 *
	 * @param data - The current read-only snapshot.
	 * @param audience - Who the view is for.
	 * @returns The projected view for that audience.
	 */
	readonly view: ( data: ReadonlyGameData<State, Config>, audience: Audience ) => View;

	/**
	 * Lifecycle hooks. Each returns events the engine accumulates at that point in a
	 * command; all are optional. They may emit game events, `InteractionOpened`, and
	 * `SeatStatusChanged`.
	 */
	readonly hooks: {
		/**
		 * Runs when a player joins, before the `PlayerJoined` event.
		 *
		 * @param data - The pre-join read-only snapshot.
		 * @param playerId - The joining player.
		 * @returns Events to accumulate for the join command.
		 */
		readonly onJoin?: (
			data: ReadonlyGameData<State, Config>,
			playerId: PlayerId
		) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;

		/**
		 * Runs on `start`, before entering the initial phase (deal cards, seed the board).
		 *
		 * @param data - The read-only snapshot at start.
		 * @returns Events to accumulate for the start command.
		 */
		readonly onStart?: ( data: ReadonlyGameData<State, Config> ) =>
			ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;

		/**
		 * Runs after a move's guards pass but before its `execute`.
		 *
		 * @param data - The read-only snapshot before the move.
		 * @param playerId - The acting player.
		 * @param moveType - The move name.
		 * @returns Events to accumulate before the move executes.
		 */
		readonly beforeMove?: (
			data: ReadonlyGameData<State, Config>,
			playerId: PlayerId,
			moveType: string
		) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;

		/**
		 * Runs after a move's `execute`, before the turn tail.
		 *
		 * @param data - The read-only snapshot after the move executed.
		 * @param playerId - The acting player.
		 * @param moveType - The move name.
		 * @returns Events to accumulate after the move executes.
		 */
		readonly afterMove?: (
			data: ReadonlyGameData<State, Config>,
			playerId: PlayerId,
			moveType: string
		) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;

		/**
		 * Runs when `endIf` first returns `true`, before `GameCompleted` (final scoring).
		 *
		 * @param data - The read-only snapshot at completion.
		 * @returns Events to accumulate at end of game.
		 */
		readonly onEnd?: ( data: ReadonlyGameData<State, Config> ) =>
			ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;
	};

	/** The declared moves, keyed by name. Each pairs a validator with an executor plus optional gates. */
	readonly moves: {
		[K in keyof MoveInputs]: {
			/** The phase this move belongs to (phased games only); the engine gates it to that phase. */
			readonly phase?: keyof PhaseMoves;

			/**
			 * Whether this player may make the move now. Defaults to "is the current
			 * player"; override for out-of-turn moves.
			 *
			 * @param data - The current read-only snapshot.
			 * @param playerId - The player attempting the move.
			 * @returns `true` if the player is allowed to act.
			 */
			readonly canMove?: ( data: ReadonlyGameData<State, Config>, playerId: PlayerId ) => boolean;

			/**
			 * Validates the move input against the rules. Pure; returns an `InvalidMove`
			 * to reject, or `undefined` to accept. Must not emit events.
			 *
			 * @param data - The current read-only snapshot.
			 * @param playerId - The acting player.
			 * @param input - The move's decoded input.
			 * @returns An `InvalidMove` rejection, or `undefined` when valid.
			 */
			readonly validate: (
				data: ReadonlyGameData<State, Config>,
				playerId: PlayerId,
				input: MoveInputs[K]["Type"]
			) => InvalidMove | undefined;

			/**
			 * Produces the events the move effects (the only way a move changes state).
			 * May emit game events, open an interaction, or change a seat's status.
			 *
			 * @param data - The read-only snapshot (already folded with any `beforeMove` events).
			 * @param playerId - The acting player.
			 * @param input - The move's decoded input.
			 * @returns The events to accumulate for this move.
			 */
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
			 * still runs. May be a boolean or a predicate of the post-move state.
			 *
			 * @param data - The read-only snapshot after the move (predicate form).
			 * @param playerId - The acting player.
			 * @param input - The move's decoded input.
			 * @returns `true` if the move ends the turn.
			 */
			readonly endsTurn?: boolean | ( (
				data: ReadonlyGameData<State, Config>,
				playerId: PlayerId,
				input: MoveInputs[K]["Type"]
			) => boolean );

			/**
			 * Config-driven capability gate. When present and it returns false
			 * for the game's config, the engine rejects the move centrally — so a
			 * variant/house-rule toggle (e.g. Uno `stacking`, `jumpIn`) disables a
			 * move without each `validate` re-checking. Absent ⇒ always enabled.
			 *
			 * @param config - The game config.
			 * @returns `true` if the move is enabled for this config.
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
			/** The move names that count as responses while a frame of this kind is active. */
			readonly responseMoves: ReadonlyArray<keyof MoveInputs>;

			/**
			 * Whether this player may respond now. Defaults per `mode` (sequential: the
			 * next responder in order; simultaneous: any responder not yet answered).
			 *
			 * @param data - The current read-only snapshot.
			 * @param frame - The active frame.
			 * @param playerId - The player attempting to respond.
			 * @returns `true` if the player may respond.
			 */
			readonly canRespond?: (
				data: ReadonlyGameData<State, Config>,
				frame: InteractionFrame,
				playerId: PlayerId
			) => boolean;

			/**
			 * Whether enough responses are in to resolve the frame. Defaults to "all
			 * responders answered".
			 *
			 * @param data - The current read-only snapshot.
			 * @param frame - The active frame.
			 * @returns `true` when the frame is ready to resolve.
			 */
			readonly isComplete?: (
				data: ReadonlyGameData<State, Config>,
				frame: InteractionFrame
			) => boolean;

			/**
			 * Resolves the window: emits the game effects the responses dictate, and may
			 * open a nested interaction (which suspends resolution until it completes).
			 *
			 * @param data - The read-only snapshot at resolution.
			 * @param frame - The frame being resolved.
			 * @returns The events to accumulate (optionally a nested `openInteraction`).
			 */
			readonly resolve: (
				data: ReadonlyGameData<State, Config>,
				frame: InteractionFrame
			) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;
		};
	};

	/**
	 * The bot policy: chooses a move for the player to act, given their snapshot.
	 * Scheduled automatically when the pending actor is a bot. Optional.
	 *
	 * @param data - The acting bot's snapshot (its own audience).
	 * @returns The move to submit, or `undefined` to pass/skip.
	 */
	readonly botMove?: ( data: GameSnapshot<View, Config> ) => BotMove<MoveInputs> | undefined;

	/**
	 * Chooses the next player after a turn-ending move (flat games; phased games use
	 * the per-phase resolver). Defaults to round-robin over the roster when absent.
	 *
	 * @param data - The read-only snapshot after the move.
	 * @param playerId - The player who just acted.
	 * @param moveType - The move that ended the turn.
	 * @returns The next current player.
	 */
	readonly resolveNextPlayer?: (
		data: ReadonlyGameData<State, Config>,
		playerId: PlayerId,
		moveType: string
	) => PlayerId;

	/** The phase a phased game enters on `start`. Required when `phases` is present. */
	readonly initialPhase?: keyof PhaseMoves;

	/** The phase definitions, keyed by phase name. Present only for phased games. */
	readonly phases?: {
		[K in keyof PhaseMoves]: {
			/** The move names legal in this phase (enumeration/validation only; the moves live in the top-level `moves`). */
			readonly moves: PhaseMoves[K];

			/**
			 * Whether this phase is over. Checked in the move tail; when `true` the
			 * engine runs `onExit`, emits `PhaseExited`, and enters `resolveNextPhase`.
			 *
			 * @param data - The current read-only snapshot.
			 * @returns `true` when the phase should end.
			 */
			readonly endIf: ( data: ReadonlyGameData<State, Config> ) => boolean;

			/**
			 * Chooses the player who acts first when this phase is entered. Absent ⇒ the
			 * current player carries over.
			 *
			 * @param data - The read-only snapshot on phase entry.
			 * @returns The starting player for the phase.
			 */
			readonly resolveStartingPlayer?: ( data: ReadonlyGameData<State, Config> ) => PlayerId;

			/**
			 * Runs on phase entry, after `PhaseEntered`, before the starting player is set.
			 *
			 * @param data - The read-only snapshot on phase entry.
			 * @returns Events to accumulate on entering the phase.
			 */
			readonly onEnter?: ( data: ReadonlyGameData<State, Config> ) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;

			/**
			 * Runs on phase exit, before `PhaseExited` (e.g. score the trick/round).
			 *
			 * @param data - The read-only snapshot on phase exit.
			 * @returns Events to accumulate on leaving the phase.
			 */
			readonly onExit?: ( data: ReadonlyGameData<State, Config> ) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;

			/**
			 * Chooses the next phase when this one ends (may return the same phase to loop).
			 *
			 * @param data - The read-only snapshot at phase end.
			 * @returns The next phase to enter.
			 */
			readonly resolveNextPhase: ( data: ReadonlyGameData<State, Config> ) => keyof PhaseMoves;

			/**
			 * Chooses the next player within this phase after a turn-ending move. Absent
			 * ⇒ the current player is left unchanged.
			 *
			 * @param data - The read-only snapshot after the move.
			 * @param playerId - The player who just acted.
			 * @param moveType - The move that ended the turn.
			 * @returns The next current player within the phase.
			 */
			readonly resolveNextPlayer?: (
				data: ReadonlyGameData<State, Config>,
				playerId: PlayerId,
				moveType: string
			) => PlayerId;
		}
	};
}
