// @s2h/swish/schema — Effect Schema definitions for the engine core.
//
// Pure / browser-safe: this module imports only `effect` and defines the data
// shapes every game shares. Games supply their own `state` / `config` / view
// schemas and compose them through the factories at the bottom of this file.

import * as Schema from "effect/Schema";

// --- Branded ids -----------------------------------------------------------
// Branding makes the three id kinds non-interchangeable at the type level, so a
// GameId can never be passed where a PlayerId is expected.

export type PlayerId = typeof PlayerId.Type;
export const PlayerId = Schema.String.pipe( Schema.brand( "PlayerId" ) );

export type GameId = typeof GameId.Type;
export const GameId = Schema.String.pipe( Schema.brand( "GameId" ) );

export type GameCode = typeof GameCode.Type;
export const GameCode = Schema.String.pipe( Schema.brand( "GameCode" ) );

// --- Enumerations ----------------------------------------------------------

export type GameStatus = typeof GameStatus.Type;
export const GameStatus = Schema.Literals( [
	"CREATED",
	"PLAYERS_READY",
	"IN_PROGRESS",
	"COMPLETED"
] );

// --- Core structs ----------------------------------------------------------

export type PlayerInfo = typeof PlayerInfo.Type;
export const PlayerInfo = Schema.TaggedStruct( "swish/PlayerInfo", {
	id: PlayerId,
	name: Schema.String,
	avatar: Schema.String,
	isBot: Schema.optional( Schema.Boolean )
} );

export type GameContext = typeof GameContext.Type;
export const GameContext = Schema.TaggedStruct( "swish/GameContext", {
	turn: Schema.Number,
	players: Schema.Array( PlayerId ),
	currentPlayer: PlayerId,
	phase: Schema.optional( Schema.String )
} );

/** Map of playerId -> PlayerInfo, the roster the engine tracks. */
export type Players = typeof Players.Type;
export const Players = Schema.Record( PlayerId, PlayerInfo );

/**
 * The minimum every game config must provide. The engine reads `playerCount`
 * to know when a game is full and `autoStart` to decide whether to schedule an
 * auto-start alarm on the last join. Games extend this with their own fields.
 */
export type BaseGameConfig = typeof BaseGameConfig.Type
export const BaseGameConfig = Schema.Struct( {
	playerCount: Schema.Number,
	autoStart: Schema.Boolean
} );


export type BasePlayerView = typeof BasePlayerView.Type;
export const BasePlayerView = Schema.Struct( {
	playerId: PlayerId
} );

export type BaseGameData = typeof BaseGameData.Type;
export const BaseGameData = Schema.Struct( {
	id: GameId,
	code: GameCode,
	players: Schema.Record( PlayerId, PlayerInfo ),
	status: GameStatus,
	context: GameContext
} );

export type InitializeInput<Config extends BaseGameConfig> = {
	id: GameId;
	code: GameCode;
	config: Config;
};

export const InitializeInput = <Config extends Schema.Top>( config: Config ) =>
	Schema.TaggedStruct(
		"swish/InitializeInput",
		{ id: GameId, code: GameCode, config }
	);

export type InitializeResponse = typeof InitializeResponse.Type;
export const InitializeResponse = Schema.TaggedStruct(
	"swish/InitializeResponse",
	{ id: GameId }
);

export type JoinGameInput = typeof JoinGameInput.Type;
export const JoinGameInput = Schema.TaggedStruct(
	"swish/JoinGameInput",
	{ code: GameCode, playerInfo: PlayerInfo }
);

export type JoinGameResponse = typeof JoinGameResponse.Type;
export const JoinGameResponse = Schema.TaggedStruct(
	"swish/JoinGameResponse",
	{ id: GameId, code: GameCode }
);

export type GameIdParams = typeof GameIdParams.Type;
export const GameIdParams = Schema.TaggedStruct(
	"swish/GameIdParams",
	{ gameId: GameId }
);

// --- Generic, game-parameterised schema factories --------------------------
// The engine never hard-codes a game's state/config/view shapes; a game passes
// its own schemas and these factories weave them into the persisted record and
// the per-request snapshot. `version` gives persisted state a migration seam.

/** The full record persisted to Durable Object storage under one key. */
export const PersistedGameData = <State extends Schema.Top, Config extends Schema.Top>(
	state: State,
	config: Config
) =>
	Schema.TaggedStruct( "swish/PersistedGameData", {
		version: Schema.Number,
		id: GameId,
		code: GameCode,
		status: GameStatus,
		context: GameContext,
		players: Players,
		config,
		state
	} );

// The DECODED record (the schema factory's `.Type`), parameterised by the
// game's decoded `State`/`Config`. The engine operates on this; `stateSchema`
// / `configSchema` encode/decode it.
export type PersistedGameData<State, Config> = {
	readonly _tag: "swish/PersistedGameData";
	readonly version: number;
	readonly id: GameId;
	readonly code: GameCode;
	readonly status: GameStatus;
	readonly context: GameContext;
	readonly players: Players;
	readonly config: Config;
	readonly state: State;
};

/** What a client receives from `GetState` / after a move: config + shared + own view. */
export const GameSnapshot = <
	Shared extends Schema.Top,
	Player extends Schema.Top,
	Config extends Schema.Top
>(
	sharedView: Shared,
	playerView: Player,
	config: Config
) =>
	Schema.TaggedStruct( "swish/GameSnapshot", {
		id: GameId,
		code: GameCode,
		status: GameStatus,
		context: GameContext,
		players: Players,
		config,
		shared: sharedView,
		player: playerView
	} );

export type GameSnapshot<Shared, Player, Config> = {
	readonly _tag: "swish/GameSnapshot";
	readonly id: GameId;
	readonly code: GameCode;
	readonly status: GameStatus;
	readonly context: GameContext;
	readonly players: Players;
	readonly config: Config;
	readonly shared: Shared;
	readonly player: Player;
};

/** Archived to KV when a game completes: shared view + every player's view. */
export const CompletedGameData = <Shared extends Schema.Top, Player extends Schema.Top>(
	sharedView: Shared,
	playerView: Player
) =>
	Schema.TaggedStruct( "swish/CompletedGameData", {
		id: GameId,
		code: GameCode,
		status: GameStatus,
		context: GameContext,
		players: Players,
		shared: sharedView,
		playerViews: Schema.Record( PlayerId, playerView )
	} );
