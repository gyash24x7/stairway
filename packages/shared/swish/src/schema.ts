// @s2h/swish/schema — Effect Schema definitions for the engine core.
//
// Pure / browser-safe: this module imports only `effect` and defines the data
// shapes every game shares. Games supply their own `state` / `config` / view
// schemas and compose them through the factories at the bottom of this file.

import { Schema } from "effect";

// --- Branded ids -----------------------------------------------------------
// Branding makes the three id kinds non-interchangeable at the type level, so a
// GameId can never be passed where a PlayerId is expected.

export const PlayerId = Schema.String.pipe( Schema.brand( "PlayerId" ) );
export type PlayerId = typeof PlayerId.Type;

export const GameId = Schema.String.pipe( Schema.brand( "GameId" ) );
export type GameId = typeof GameId.Type;

export const GameCode = Schema.String.pipe( Schema.brand( "GameCode" ) );
export type GameCode = typeof GameCode.Type;

// --- Enumerations ----------------------------------------------------------

export const GameStatus = Schema.Literals( [
	"CREATED",
	"PLAYERS_READY",
	"IN_PROGRESS",
	"COMPLETED"
] );
export type GameStatus = typeof GameStatus.Type;

// --- Core structs ----------------------------------------------------------

export class PlayerInfo extends Schema.TaggedClass<PlayerInfo>()( "swish/PlayerInfo", {
	id: PlayerId,
	name: Schema.String,
	avatar: Schema.String,
	isBot: Schema.optional( Schema.Boolean )
} ) {}

export class GameContext extends Schema.TaggedClass<GameContext>()( "swish/GameContext", {
	turn: Schema.Number,
	players: Schema.Array( PlayerId ),
	currentPlayer: PlayerId,
	phase: Schema.optional( Schema.String )
} ) {}

/** Map of playerId -> PlayerInfo, the roster the engine tracks. */
export const Players = Schema.Record( PlayerId, PlayerInfo );
export type Players = typeof Players.Type;

/**
 * The minimum every game config must provide. The engine reads `playerCount`
 * to know when a game is full and `autoStart` to decide whether to schedule an
 * auto-start alarm on the last join. Games extend this with their own fields.
 */
export interface BaseGameConfig {
	readonly playerCount: number;
	readonly autoStart?: boolean;
}

// --- Generic, game-parameterised schema factories --------------------------
// The engine never hard-codes a game's state/config/view shapes; a game passes
// its own schemas and these factories weave them into the persisted record and
// the per-request snapshot. `version` gives persisted state a migration seam.

/** The full record persisted to Durable Object storage under one key. */
export const PersistedGameData = <State extends Schema.Top, Config extends Schema.Top>(
	state: State,
	config: Config
) =>
	Schema.Struct( {
		version: Schema.Number,
		id: GameId,
		code: GameCode,
		status: GameStatus,
		context: GameContext,
		players: Players,
		config,
		state
	} );

export type PersistedGameData<State, Config> = {
	readonly version: number;
	readonly id: GameId;
	readonly code: GameCode;
	readonly status: GameStatus;
	readonly context: GameContext;
	readonly players: Players;
	readonly config: Config;
	readonly state: State;
};

/** What a client receives from `GetState` / after a move: shared + own view. */
export const GameSnapshot = <Shared extends Schema.Top, Player extends Schema.Top>(
	sharedView: Shared,
	playerView: Player
) =>
	Schema.Struct( {
		id: GameId,
		code: GameCode,
		status: GameStatus,
		context: GameContext,
		players: Players,
		shared: sharedView,
		player: playerView
	} );

export type GameSnapshot<Shared, Player> = {
	readonly id: GameId;
	readonly code: GameCode;
	readonly status: GameStatus;
	readonly context: GameContext;
	readonly players: Players;
	readonly shared: Shared;
	readonly player: Player;
};

/** Archived to KV when a game completes: shared view + every player's view. */
export const CompletedGameData = <Shared extends Schema.Top, Player extends Schema.Top>(
	sharedView: Shared,
	playerView: Player
) =>
	Schema.Struct( {
		id: GameId,
		code: GameCode,
		status: GameStatus,
		context: GameContext,
		players: Players,
		shared: sharedView,
		playerViews: Schema.Record( PlayerId, playerView )
	} );
