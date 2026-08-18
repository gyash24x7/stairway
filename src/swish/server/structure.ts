import type * as Schema from "effect/Schema";

import type { Rng } from "@/shared/utils/rng.ts";
import type {
	Audience,
	BaseGameConfig,
	BaseGameEvent,
	GameData,
	InteractionFrame,
	InteractionOpened,
	InvalidMove,
	PlayerId,
	SeatStatusChanged,
	Standings
} from "@/swish/shared/schema.ts";

/**
 * The complete, declarative contract for a game.
 * It defines the following -
 * - Schemas for state, config, events, views and moves
 * - Reducers to apply the game events to the state)
 * - Factories to generate initial state (setup), playerViews (tableView/playerView) & endIf
 * - Move Rules including validation, execution and other gates
 * - Lifecycle Hooks for different points in game (Optional)
 * - Interactions that can happen in a game (Optional)
 * - BotMove: Decides the move for a bot on its turn (Optional)
 * - Phases that the game has and hooks to tap into phase transitions
 * - Next player and game results resolution logic
 *
 * @typeParam Name - The game's unique name (channel/archive key prefix).
 * @typeParam State - The game-owned state shape (opaque to the engine).
 * @typeParam Config - The game config, extending `BaseGameConfig`.
 * @typeParam MoveInputs - Map of move name → input schema.
 * @typeParam PhaseMoves - Map of phase name → the move names legal in it.
 * @typeParam Events - The game's domain event union.
 * @typeParam View - The redacted game info built for one audience
 */
export type GameStructure<
	Name extends string,
	State,
	Config extends BaseGameConfig,
	MoveInputs extends Record<string, Schema.Top>,
	PhaseMoves extends Record<string, ReadonlyArray<keyof MoveInputs>>,
	Events extends BaseGameEvent,
	View
> = {
	/**
	 * The game's unique name.
	 * Used as key prefix for archive and sync.
	 */
	readonly name: Name;

	/**
	 * The game's schemas.
	 * Used for defining API surface.
	 * - state: Schema for Game State
	 * - config: Schema for Game Config extends BaseGameConfig
	 * - events: Schema for events specific to this game
	 * - view: Schema for the redacted game info sent to any audience
	 * - moves:
	 * 		- moveName: Schema for the move input for this move
	 */
	readonly schemas: {
		readonly state: Schema.Codec<State, unknown>;
		readonly config: Schema.Codec<Config, unknown>;
		readonly events: Schema.Codec<Events, unknown>;
		readonly view: Schema.Codec<View, unknown>;
		readonly moves: {
			[K in keyof MoveInputs]: MoveInputs[K];
		};
	};

	/**
	 * Builds the initial state for a fresh game from its config.
	 * Any generation/shuffle etc should use the provided RNG factory
	 * to build reproducible initial state.
	 *
	 * @param config - The game config supplied at creation.
	 * @param rng - Deterministic RNG factory for the game's seed, salted per call.
	 * @returns The initial game state.
	 */
	readonly setup: ( config: Config, rng: ( salt?: string ) => Rng ) => State;

	/**
	 * The pure reducer for events specific to this game.
	 * It is the only function that changes the state.
	 *
	 * @param state - The current state.
	 * @param event - The game event to apply.
	 * @returns The next state.
	 */
	readonly apply: ( state: State, event: Events ) => State;

	/**
	 * Decides when to end the game. Evaluated after every move.
	 * If true, the game runs onEnd, completes the game and archives it.
	 *
	 * In a phased game the ask lands *before* the next phase is entered, so this
	 * sees the position the round ended in rather than the table that phase's
	 * `onEnter` would have set up for the next one. An end condition phrased as
	 * "there is nothing left to draw" can therefore be written plainly: the deck
	 * this reads is the one the round was played from, not one a fresh row has
	 * already been taken off.
	 *
	 * @param data - The current read-only snapshot.
	 * @returns `true` when the game has ended.
	 */
	readonly endIf: ( data: GameData<State, Config> ) => boolean;

	/**
	 * Used by the game to compute the final standings of a game.
	 * Called by the engine once the game completes.
	 *
	 * A team game only has to rank the players: the engine stamps each standing
	 * with its side and compiles the per-side ranking from what comes back, by
	 * total score where the game scores and by each side's best rank where it does
	 * not. Fill `teamRanking` or `winningTeam` yourself to decide it another way.
	 *
	 * @param data - The completed game's read-only snapshot.
	 * @returns The final ranking (and optional winner).
	 */
	readonly resolveResults?: ( data: GameData<State, Config> ) => Standings;

	/**
	 * Redacts the state into the view an audience is allowed to see. One shape
	 * serves everyone: a `TableAudience` gets the game with every private region
	 * hidden, a `PlayerAudience` gets the same shape with that player's own
	 * regions filled in. Model hidden information explicitly — an opponent's
	 * hand as a count rather than an absent field — so a client renders one
	 * view type instead of branching on who is watching.
	 *
	 * @param data - The current read-only snapshot.
	 * @param audience - Who the view is being built for.
	 * @returns The projected view for that audience.
	 */
	readonly view: ( data: GameData<State, Config>, audience: Audience ) => View;

	/**
	 * Lifecycle hooks. Each returns events the engine accumulates at that point in a
	 * command; all are optional. They may emit game events.
	 */
	readonly hooks: {
		/**
		 * Runs when a player joins, before the `PlayerJoined` event.
		 * @param data - The pre-join read-only snapshot.
		 * @param playerId - The joining player.
		 * @returns Events to accumulate for the join command.
		 */
		readonly onJoin?: (
			data: GameData<State, Config>,
			playerId: PlayerId
		) => ReadonlyArray<Events>;

		/**
		 * Runs on `start`, before entering the initial phase (if phased game.)
		 *
		 * This is where a game that deals to its seats does so: `setup` runs at
		 * `initialize`, when the table is still empty, so the roster and the seating
		 * order only exist here.
		 *
		 * @param data - The read-only snapshot at start.
		 * @param rng - RNG factory for the start commit, salted per call. Randomness is
		 * 		safe here for the same reason it is in `execute`: the *outcome* rides the
		 * 		emitted events, and replay folds those events rather than re-running this.
		 * @returns Events to accumulate for the start command.
		 */
		readonly onStart?: (
			data: GameData<State, Config>,
			rng: ( salt?: string ) => Rng
		) => ReadonlyArray<Events>;

		/**
		 * Runs after the phase/turn guards pass, but before the move's own validate.
		 * Use it to roll the board forward into the position the move acts on.
		 * If validate fails, the commit (which includes the returned events)
		 * is discarded altogether.
		 *
		 * @param data - The read-only snapshot before the move.
		 * @param playerId - The acting player.
		 * @param moveType - The move name.
		 * @returns Events to accumulate before the move is validated and executed.
		 */
		readonly beforeMove?: (
			data: GameData<State, Config>,
			playerId: PlayerId,
			moveType: string
		) => ReadonlyArray<Events>;

		/**
		 * Runs after a move's `execute`, before the turn tail.
		 * @param data - The read-only snapshot after the move executed.
		 * @param playerId - The acting player.
		 * @param moveType - The move name.
		 * @returns Events to accumulate after the move executes.
		 */
		readonly afterMove?: (
			data: GameData<State, Config>,
			playerId: PlayerId,
			moveType: string
		) => ReadonlyArray<Events>;

		/**
		 * Runs when `endIf` returns `true`, but before the game completion.
		 * @param data - The read-only snapshot at completion.
		 * @returns Events to accumulate at end of game.
		 */
		readonly onEnd?: ( data: GameData<State, Config> ) => ReadonlyArray<Events>;
	};

	readonly moves: {
		[K in keyof MoveInputs]: {

			/**
			 * Whether this player can make the move now.
			 * Defaults to playerId === currentPlayer.
			 * Override to allow for out of turn moves.
			 *
			 * @param data - The current read-only snapshot.
			 * @param playerId - The player attempting the move.
			 * @returns `true` if the player is allowed to act.
			 */
			readonly canMove?: ( data: GameData<State, Config>, playerId: PlayerId ) => boolean;

			/**
			 * Validates the move input against the rules. Returns an `InvalidMove`
			 * to reject, or `undefined` to accept. Must not emit events.
			 *
			 * @param data - The read-only snapshot after the beforeMove hook is executed.
			 * @param playerId - The acting player.
			 * @param input - The move's decoded input.
			 * @returns An `InvalidMove` rejection, or `undefined` when valid.
			 */
			readonly validate: (
				data: GameData<State, Config>,
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
			 * @param rng - RNG factory for this commit, salted per call. Randomness is safe
			 * 		here because the *outcome* is recorded in the emitted events; replay folds
			 * 		those events and never re-runs `execute`.
			 * @returns The events to accumulate for this move.
			 */
			readonly execute: (
				data: GameData<State, Config>,
				playerId: PlayerId,
				input: MoveInputs[K]["Type"],
				rng: ( salt?: string ) => Rng
			) => ReadonlyArray<Events | InteractionOpened | SeatStatusChanged>;

			/**
			 * Whether this move ends the acting player's turn (default `true`). When
			 * `false` the engine keeps `currentPlayer` and does not advance the turn
			 * or resolve the next player.
			 * Used for games where one turn includes many actions.
			 *
			 * @param data - The read-only snapshot after the move.
			 * @param playerId - The acting player.
			 * @param input - The move's decoded input.
			 * @returns `true` if the move ends the turn.
			 */
			readonly endsTurn?: boolean | ( (
				data: GameData<State, Config>,
				playerId: PlayerId,
				input: MoveInputs[K]["Type"]
			) => boolean );

			/**
			 * Config-driven capability gate. When present and it returns false
			 * for the game's config, the engine rejects the move centrally.
			 * Used to tailor moves to a specific variant of the game.
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
	 * effects plus a nested `openInteraction`.
	 * A frame that outlives its `deadline` is force-settled — see `timeoutMillis`
	 * and `onTimeout` — so a silent responder cannot stall the table.
	 * Games that never open an interaction omit this entirely.
	 */
	readonly interactions?: {
		readonly [ kind: string ]: {
			/**
			 * The moves that count as responses while a frame of this kind is active.
			 */
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
				data: GameData<State, Config>,
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
			readonly isComplete?: ( data: GameData<State, Config>, frame: InteractionFrame ) => boolean;

			/**
			 * How long a frame of this kind stays open, overriding the config's
			 * `interactionTimeoutMillis`. The engine stamps `now + timeout` onto the
			 * frame's `deadline` as it opens. With neither set the frame never expires.
			 */
			readonly timeoutMillis?: number;

			/**
			 * Force-closes a frame whose deadline passed with responses still missing.
			 * Only reached when the game declares no `botMove` to answer on the silent
			 * responders' behalf; absent, the engine falls back to `resolve` with
			 * whatever responses did arrive.
			 *
			 * A frame opened here replaces the one that expired, exactly as one opened
			 * from `resolve` does.
			 *
			 * @param data - The read-only snapshot at expiry.
			 * @param frame - The frame that timed out, holding the partial responses.
			 * @returns The events to accumulate (optionally a nested `openInteraction`).
			 */
			readonly onTimeout?: (
				data: GameData<State, Config>,
				frame: InteractionFrame
			) => ReadonlyArray<Events | InteractionOpened>;

			/**
			 * Resolves the window: emits the game effects the responses dictate, and may
			 * open a nested interaction.
			 *
			 * The frame being resolved always closes. A nested one opened here takes its
			 * place at the top of the stack rather than sitting above it, so the
			 * unwinding suspends there: the turn does not advance, and the table waits
			 * on the new frame's responders. Resolution never revisits a frame it has
			 * already resolved.
			 *
			 * @param data - The read-only snapshot at resolution.
			 * @param frame - The frame being resolved.
			 * @returns The events to accumulate (optionally a nested `openInteraction`).
			 */
			readonly resolve: (
				data: GameData<State, Config>,
				frame: InteractionFrame
			) => ReadonlyArray<Events | InteractionOpened>;
		};
	};

	/**
	 * The bot policy: chooses a move for the player to act, given their snapshot.
	 * Scheduled automatically when the pending actor is a bot, or when a human
	 * seat has been handed over to it — either deliberately through `setAutoPlay`
	 * or because that seat's clock ran out. It sees the same redacted `View` the
	 * seat's own client does, so it never learns more than the player it plays for.
	 * Optional; without it a game cannot enforce its timeouts by playing on a
	 * silent player's behalf, and the engine skips or force-settles instead.
	 *
	 * @param data - The acting seat's data.
	 * @returns The move to submit, or `undefined` to pass/skip.
	 */
	readonly botMove?: ( data: GameData<View, Config> ) => {
		readonly [K in keyof MoveInputs]: {
			readonly moveType: K;
			readonly input: MoveInputs[K]["Type"];
		}
	}[keyof MoveInputs] | undefined;

	/**
	 * Flat Games only.
	 * Chooses the next player after a turn-ending move.
	 * Defaults to round-robin over the roster when absent.
	 *
	 * A team game rarely needs this: its seats are interleaved at `start`, so the
	 * default already alternates sides. It does stop alternating once a seat goes
	 * inactive, since the default skips those — a game that cannot live with that
	 * resolves the turn itself, reading `context.teams` through the helpers in
	 * `shared/swish/teams.ts`.
	 *
	 * @param data - The read-only snapshot after the move.
	 * @param playerId - The player who just acted.
	 * @param moveType - The move that ended the turn.
	 * @returns The next current player.
	 */
	readonly resolveNextPlayer?: (
		data: GameData<State, Config>,
		playerId: PlayerId,
		moveType: string
	) => PlayerId;

	/**
	 * Phased Games only.
	 * The phase a phased game enters on `start`.
	 * Required when `phases` is present.
	 */
	readonly initialPhase?: keyof PhaseMoves;

	/**
	 * Phased Games only.
	 * The phase definitions, keyed by phase name.
	 */
	readonly phases?: {
		[K in keyof PhaseMoves]: {

			/**
			 * The move names legal in this phase.
			 */
			readonly moves: PhaseMoves[K];

			/**
			 * Whether this phase is over. Checked in the move tail; when `true` the
			 * engine runs `onExit`, emits `PhaseExited`, and enters `resolveNextPhase`.
			 *
			 * @param data - The current read-only snapshot.
			 * @returns `true` when the phase should end.
			 */
			readonly endIf: ( data: GameData<State, Config> ) => boolean;

			/**
			 * Chooses the player who acts first when this phase is entered. Absent ⇒ the
			 * current player carries over.
			 *
			 * @param data - The read-only snapshot on phase entry.
			 * @returns The starting player for the phase.
			 */
			readonly resolveStartingPlayer?: ( data: GameData<State, Config> ) => PlayerId;

			/**
			 * Runs on phase entry, after `PhaseEntered`, before the starting player is set.
			 * @param data - The read-only snapshot on phase entry.
			 * @returns Events to accumulate on entering the phase.
			 */
			readonly onEnter?: (
				data: GameData<State, Config>,
				rng: ( salt?: string ) => Rng
			) => ReadonlyArray<Events>;

			/**
			 * Runs on phase exit, before `PhaseExited`.
			 * @param data - The read-only snapshot on phase exit.
			 * @returns Events to accumulate on leaving the phase.
			 */
			readonly onExit?: ( data: GameData<State, Config> ) => ReadonlyArray<Events>;

			/**
			 * Chooses the next phase when this one ends (may return the same phase to loop).
			 * @param data - The read-only snapshot at phase end.
			 * @returns The next phase to enter.
			 */
			readonly resolveNextPhase: ( data: GameData<State, Config> ) => keyof PhaseMoves;

			/**
			 * Chooses the next player within this phase after a turn-ending move.
			 * Absent ⇒ the current player is left unchanged.
			 *
			 * @param data - The read-only snapshot after the move.
			 * @param playerId - The player who just acted.
			 * @param moveType - The move that ended the turn.
			 * @returns The next current player within the phase.
			 */
			readonly resolveNextPlayer?: (
				data: GameData<State, Config>,
				playerId: PlayerId,
				moveType: string
			) => PlayerId;
		}
	};
};
