/** Unique identifier for a player. */
export type PlayerId = string;

/** Base information about a player in a game. */
export type BasePlayerInfo = {
	id: PlayerId;
	name: string;
	avatar: string;
	isBot?: boolean;
}

/**
 * The current game context tracking turn state and player order.
 * Includes the current turn number, player list, active player, and optional phase.
 */
export type GameContext = {
	turn: number;
	players: PlayerId[];
	currentPlayer: PlayerId;
	phase?: string;
}

/** Base configuration required by all games, specifying player count and optional auto-start. */
export type BaseGameConfig = { playerCount: number; autoStart?: boolean };

/**
 * Validation function for a move, throwing an error if the input is invalid.
 * @param data - The read-only game data.
 * @param playerId - The ID of the player making the move.
 * @param input - The move input to validate.
 */
export type ValidateFn<G, C extends BaseGameConfig, I = unknown> = (
	data: ReadonlyGameData<G, C>,
	playerId: PlayerId,
	input: I
) => void;

/**
 * Execution function for a move that returns the updated game state.
 * @param data - The read-only game data.
 * @param playerId - The ID of the player making the move.
 * @param input - The validated move input.
 * @returns The new game state after executing the move.
 */
export type ExecuteFn<G, C extends BaseGameConfig, I = unknown> = (
	data: ReadonlyGameData<G, C>,
	playerId: PlayerId,
	input: I
) => G;

/**
 * Function that determines whether a player is allowed to make a specific move.
 * @param data - The read-only game data.
 * @param playerId - The ID of the player to check.
 * @returns True if the player can make the move, false otherwise.
 */
export type CanMoveFn<G, C extends BaseGameConfig> = (
	data: ReadonlyGameData<G, C>,
	playerId: PlayerId
) => boolean;

/**
 * A move definition containing optional permission check, validation, and execution logic.
 */
export type Move<G, C extends BaseGameConfig, I = unknown> = {
	canMove?: CanMoveFn<G, C>;
	validate: ValidateFn<G, C, I>;
	execute: ExecuteFn<G, C, I>;
};

/** Internal base type for move maps. */
type BaseMoveMap = Record<string, unknown>;

/** A typed map of move names to their Move definitions. */
export type MoveMap<G, C extends BaseGameConfig, M extends BaseMoveMap> = {
	[K in keyof M]: Move<G, C, M[K]>;
};

/** The type-level key of a move within a move map. */
export type MoveType<M extends BaseMoveMap> = keyof M;

/**
 * Function that resolves the next player after a move is made.
 * @param data - The read-only game data.
 * @param playerId - The ID of the player who just moved.
 * @param moveType - The type of move that was made.
 * @returns The PlayerId of the next player.
 */
export type ResolveNextPlayerFn<G, M extends BaseMoveMap, C extends BaseGameConfig> = (
	data: ReadonlyGameData<G, C>,
	playerId: PlayerId,
	moveType: MoveType<M>
) => PlayerId;

/**
 * Function that determines a bot's move given the current game state from its perspective.
 * @param data - The read-only game data from the bot's player view.
 * @returns An object containing the move type and input for the bot's move.
 */
export type BotMoveFn<G, C extends BaseGameConfig, M extends BaseMoveMap> = ( data: ReadonlyGameData<G, C> ) => {
	moveType: keyof M;
	input: M[keyof M]
};

/**
 * Lifecycle hooks that fire at various points during the game.
 * Each hook receives the current read-only game data and returns the updated game state.
 */
export type GameHooks<G, M extends BaseMoveMap, C extends BaseGameConfig> = {
	onJoin?: ( data: ReadonlyGameData<G, C>, playerId: PlayerId ) => G;
	onStart?: ( data: ReadonlyGameData<G, C> ) => G;
	beforeMove?: ( data: ReadonlyGameData<G, C>, playerId: PlayerId, moveType: keyof M ) => G;
	afterMove?: ( data: ReadonlyGameData<G, C>, playerId: PlayerId, moveType: keyof M ) => G;
	onEnd?: ( data: ReadonlyGameData<G, C> ) => G;
};

/** Unique identifier for a game instance. */
export type GameId = string;

/** Base game data containing the game ID and join code. */
export type BaseGameData = { id: GameId; code: string };

/** Base player view containing the requesting player's ID. */
export type BasePlayerView = { playerId: PlayerId };

/** The possible statuses a game can be in throughout its lifecycle. */
export type GameStatus = "CREATED" | "PLAYERS_READY" | "IN_PROGRESS" | "COMPLETED";

/**
 * A read-only snapshot of game data used for safe access within move logic and hooks.
 * Config and context are frozen to prevent mutation.
 */
export type ReadonlyGameData<G, C extends BaseGameConfig> = {
	state: G;
	config: Readonly<C>;
	context: Readonly<GameContext>;
}

/**
 * The full mutable game data including state, config, context, status, and player records.
 */
export type GameData<G, C extends BaseGameConfig> = {
	config: C;
	state: G;
	context: GameContext;
	status: GameStatus;
	players: Record<PlayerId, BasePlayerInfo>;
}

/**
 * A game phase definition with its own moves, player resolution, end condition,
 * phase transitions, and optional lifecycle hooks.
 */
export type GamePhase<G, M extends BaseMoveMap, C extends BaseGameConfig> = {
	moves: MoveMap<G, C, M>;
	resolveNextPlayer: ResolveNextPlayerFn<G, M, C>;
	endIf: ( data: ReadonlyGameData<G, C> ) => boolean;
	resolveNextPhase: ( data: ReadonlyGameData<G, C> ) => string;
	onEnter?: ( data: ReadonlyGameData<G, C> ) => G;
	onExit?: ( data: ReadonlyGameData<G, C> ) => G;
	resolveStartingPlayer?: ( data: ReadonlyGameData<G, C> ) => PlayerId;
	botMove?: BotMoveFn<any, C, M>;
	hooks?: Pick<GameHooks<G, M, C>, "beforeMove" | "afterMove">;
};

/** A record mapping phase names to their GamePhase definitions. */
export type GamePhases<G, C extends BaseGameConfig> = Record<string, GamePhase<G, any, C>>;

/**
 * Internal base structure shared by all game definitions.
 * Contains the game name, setup function, hooks, end condition, and player view generator.
 */
type BaseGameStructure<
	G,
	M extends BaseMoveMap,
	C extends BaseGameConfig,
	V extends BasePlayerView
> = {
	name: string;
	setup: ( input: C ) => G;
	hooks?: GameHooks<G, M, C>;
	endIf: ( data: ReadonlyGameData<G, C> ) => boolean;
	playerView: ( data: ReadonlyGameData<G, C>, playerId: PlayerId ) => V;
};

/**
 * A phased game structure where gameplay is divided into named phases,
 * each with its own moves, player resolution, and transition logic.
 */
export type PhasedGameStructure<G, C extends BaseGameConfig = BaseGameConfig> = {
	phases: GamePhases<G, C>;
	initialPhase: string;
	moves?: undefined;
	resolveNextPlayer?: undefined;
	botMove?: undefined;
}

/**
 * A flat (non-phased) game structure with a single set of moves,
 * a player resolution function, and optional bot move support.
 */
export type FlatGameStructure<
	G,
	M extends BaseMoveMap = {},
	C extends BaseGameConfig = BaseGameConfig,
	V extends BasePlayerView = BasePlayerView & G
> = {
	phases?: undefined;
	moves: MoveMap<G, C, M>;
	resolveNextPlayer: ResolveNextPlayerFn<G, M, C>;
	botMove?: BotMoveFn<V, C, M>;
};

/**
 * The complete game structure type, combining base fields with either
 * a flat or phased game structure via a discriminated union.
 */
export type GameStructure<
	G,
	M extends BaseMoveMap = {},
	C extends BaseGameConfig = BaseGameConfig,
	V extends BasePlayerView = BasePlayerView & G
> = BaseGameStructure<G, M, C, V> & ( FlatGameStructure<G, M, C, V> | PhasedGameStructure<G, C> );

/** Input type for operations that require a game ID. */
export type GameIdInput = { gameId: GameId };

/** Input type for joining a game by its short join code. */
export type JoinGameInput = { code: string };
