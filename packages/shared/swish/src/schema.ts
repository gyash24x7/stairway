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

// --- Reaction / interaction windows ----------------------------------------
// An opt-in priority window (challenge / block / "Just Say No" / rent / bid).
// When one is open the engine routes moves to the frame's `responders` instead
// of `currentPlayer` and suppresses turn advancement until it resolves. Nesting
// is a stack (array on GameContext); the top frame is the active one. `payload`
// / `responses` are `Unknown` so the engine stays game-agnostic — the game's
// `resolve` narrows them.

// Per-seat status. Absent ⇒ "active". Games flip a seat to folded/eliminated/out
// (poker fold/all-in, Coup influence loss, Monopoly bankruptcy) and use the
// `activeSeats`/`isActiveSeat` helpers (events.ts) to skip them in turn order.
export type SeatStatus = typeof SeatStatus.Type;
export const SeatStatus = Schema.Literals( [ "active", "folded", "eliminated", "out" ] );

export type InteractionMode = typeof InteractionMode.Type;
export const InteractionMode = Schema.Literals( [ "sequential", "simultaneous" ] );

export type InteractionFrame = typeof InteractionFrame.Type;
export const InteractionFrame = Schema.TaggedStruct( "swish/InteractionFrame", {
	kind: Schema.String,
	initiator: PlayerId,
	responders: Schema.Array( PlayerId ),
	mode: InteractionMode,
	responses: Schema.Record( PlayerId, Schema.Unknown ),
	target: Schema.optional( PlayerId ),
	payload: Schema.optional( Schema.Unknown ),
	deadline: Schema.optional( Schema.Number )
} );

export type GameContext = typeof GameContext.Type;
export const GameContext = Schema.TaggedStruct( "swish/GameContext", {
	turn: Schema.Number,
	players: Schema.Array( PlayerId ),
	currentPlayer: PlayerId,
	phase: Schema.optional( Schema.String ),
	// The reaction stack; undefined/absent for games that never open one.
	interactions: Schema.optional( Schema.Array( InteractionFrame ) ),
	// Per-seat status map; absent entries (and the whole field) mean "active".
	seats: Schema.optional( Schema.Record( PlayerId, SeatStatus ) )
} );

/** Map of playerId -> PlayerInfo, the roster the engine tracks. */
export type Players = typeof Players.Type;
export const Players = Schema.Record( PlayerId, PlayerInfo );

// --- Audience --------------------------------------------------------------
// Who a view is being rendered for. A `Player` audience sees the public board
// PLUS their own private slice; `Table` is the shared spectator / board view
// (couch mode) — no private slice, and no player identity required. The tag is
// the seam a future per-audience event redaction would switch on too.

export type Audience = typeof Audience.Type;
export const Audience = Schema.Union( [
	Schema.TaggedStruct( "swish/Player", { id: PlayerId } ),
	Schema.TaggedStruct( "swish/Table", {} )
] );

// Return the NARROW variant types (not the `Audience` union): the generated
// HttpApi client gives `getState` a per-member payload overload, so a value
// typed as the wide union is not assignable to a single member.
export const playerAudience = ( id: PlayerId ) => ( { _tag: "swish/Player" as const, id } );
export const tableAudience = () => ( { _tag: "swish/Table" as const } );

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
	seed?: string;
};

export const InitializeInput = <Config extends Schema.Top>( config: Config ) =>
	Schema.TaggedStruct(
		"swish/InitializeInput",
		{ id: GameId, code: GameCode, config, seed: Schema.optional( Schema.String ) }
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
		// Server-only PRNG seed captured at initialize. Optional so records
		// persisted before seeding was added still decode. NEVER exposed to
		// clients (absent from GameContext / GameSnapshot / CompletedGameData).
		seed: Schema.optional( Schema.String ),
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
	readonly seed?: string;
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
	View extends Schema.Top,
	Config extends Schema.Top
>(
	view: View,
	config: Config
) =>
	Schema.TaggedStruct( "swish/GameSnapshot", {
		id: GameId,
		code: GameCode,
		status: GameStatus,
		context: GameContext,
		players: Players,
		config,
		view
	} );

export type GameSnapshot<View, Config> = {
	readonly _tag: "swish/GameSnapshot";
	readonly id: GameId;
	readonly code: GameCode;
	readonly status: GameStatus;
	readonly context: GameContext;
	readonly players: Players;
	readonly config: Config;
	readonly view: View;
};

// --- Standings -------------------------------------------------------------
// Canonical end-of-game result (#12): a ranking + optional winner, computed by
// a game's `resolveResults` on completion so every UI (and the couch winner
// screen) renders placement without re-deriving it.

export type Standing = typeof Standing.Type;
export const Standing = Schema.Struct( {
	playerId: PlayerId,
	rank: Schema.Number,
	score: Schema.optional( Schema.Number ),
	team: Schema.optional( Schema.String )
} );

export type Standings = typeof Standings.Type;
export const Standings = Schema.Struct( {
	ranking: Schema.Array( Standing ),
	winner: Schema.optional( PlayerId )
} );

// --- Action feed -----------------------------------------------------------
// A structured, human-readable log entry derived from the event stream (#11):
// the TV ticker / chat feed / debugging feed. `at`/`actor` come from the commit;
// `text` from the game's `describe`. Redaction-safe by construction.

export type LogEntry = typeof LogEntry.Type;
export const LogEntry = Schema.Struct( {
	at: Schema.Number,
	actor: Schema.optional( PlayerId ),
	kind: Schema.String,
	text: Schema.String
} );

export type GameLog = typeof GameLog.Type;
export const GameLog = Schema.Array( LogEntry );

export type MovePayload<In extends Schema.Top> = {
	readonly playerInfo: PlayerInfo;
	readonly input: In[ "Type" ];
	readonly requestId?: string;
	readonly expectedTurn?: number;
};

export const MovePayload = <In extends Schema.Top>( input: In ) =>
	Schema.Struct( {
		playerInfo: PlayerInfo,
		input,
		requestId: Schema.optionalKey( Schema.String ),
		expectedTurn: Schema.optionalKey( Schema.Number )
	} );

/** Archived to KV when a game completes: shared view + every player's view. */
export const CompletedGameData = <View extends Schema.Top>( view: View ) =>
	Schema.TaggedStruct( "swish/CompletedGameData", {
		id: GameId,
		code: GameCode,
		status: GameStatus,
		context: GameContext,
		players: Players,
		table: view,
		playerViews: Schema.Record( PlayerId, view ),
		results: Schema.optional( Standings )
	} );
