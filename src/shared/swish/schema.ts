import * as Schema from "effect/Schema";

// --- Branded ids -----------------------------------------------------------
// Branding makes the three id kinds non-interchangeable at the type level, so a
// GameId can never be passed where a PlayerId is expected.

/** A player's unique id, branded so it can't be passed where another id kind is expected. */
export type PlayerId = typeof PlayerId.Type;
export const PlayerId = Schema.String.pipe( Schema.brand( "PlayerId" ) );

/** A game's unique id (one per Durable Object), branded. */
export type GameId = typeof GameId.Type;
export const GameId = Schema.String.pipe( Schema.brand( "GameId" ) );

/** A short, human-shareable code used to join a game, branded. */
export type GameCode = typeof GameCode.Type;
export const GameCode = Schema.String.pipe( Schema.brand( "GameCode" ) );

// --- Enumerations ----------------------------------------------------------

/** The game's lifecycle status: created → players ready → in progress → completed. */
export type GameStatus = typeof GameStatus.Type;
export const GameStatus = Schema.Literals( [
	"CREATED",
	"PLAYERS_READY",
	"IN_PROGRESS",
	"COMPLETED"
] );

// --- Core structs ----------------------------------------------------------

/** A player (or bot) at the table: id, display name, avatar, and an optional bot flag. */
export type PlayerInfo = typeof PlayerInfo.Type;
export const PlayerInfo = Schema.TaggedStruct( "swish/PlayerInfo", {
	id: PlayerId,
	name: Schema.String,
	avatar: Schema.String,
	isBot: Schema.optional( Schema.Boolean )
} );

// --- Reaction / interaction windows ----------------------------------------

/**
 * A seat's status. Absent ⇒ `"active"`. Games flip a seat to
 * folded/eliminated/out (poker fold/all-in, Coup influence loss, Monopoly
 * bankruptcy) and use the `activeSeats`/`isActiveSeat` helpers (events.ts) to
 * skip them in turn order.
 */
export type SeatStatus = typeof SeatStatus.Type;
export const SeatStatus = Schema.Literals( [ "active", "folded", "eliminated", "out" ] );

/**
 * How a reaction window collects responses: `sequential` (one responder at a
 * time, in order) or `simultaneous` (all responders answer independently, and
 * their in-flight answers are redacted from each other).
 */
export type InteractionMode = typeof InteractionMode.Type;
export const InteractionMode = Schema.Literals( [ "sequential", "simultaneous" ] );

/**
 * An opt-in priority window (challenge / block / "Just Say No" / rent / bid). When
 * one is open the engine routes moves to the frame's `responders` instead of
 * `currentPlayer` and suppresses turn advancement until it resolves. Nesting is a
 * stack (the `interactions` array on `GameContext`); the top frame is active.
 * `payload`/`responses` are `Unknown` so the engine stays game-agnostic — the
 * game's `resolve` narrows them.
 *
 * Fields: `kind` selects the matching `interactions[kind]` definition; `initiator`
 * is who opened it; `responders` are who may answer; `mode` is sequential vs
 * simultaneous; `responses` maps responder → their answer; `target` is an optional
 * focused player; `payload` is game-specific context; `deadline` is an optional
 * timeout (epoch ms).
 */
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

/**
 * The engine-owned envelope tracking whose turn it is and the flow of play:
 * `turn` counter, the seated `players` in order, the `currentPlayer`, the optional
 * active `phase`, the `interactions` stack, and per-seat `seats` statuses. The
 * game's own state lives separately; the engine never reads inside it.
 */
export type GameContext = typeof GameContext.Type;
export const GameContext = Schema.TaggedStruct( "swish/GameContext", {
	turn: Schema.Number,
	players: Schema.Array( PlayerId ),
	currentPlayer: PlayerId,
	phase: Schema.optional( Schema.String ),
	interactions: Schema.optional( Schema.Array( InteractionFrame ) ),
	seats: Schema.optional( Schema.Record( PlayerId, SeatStatus ) )
} );

/** The roster: a map of player id → `PlayerInfo`. */
export type Players = typeof Players.Type;
export const Players = Schema.Record( PlayerId, PlayerInfo );

// --- Audience --------------------------------------------------------------
// Who a view is being rendered for. A `Player` audience sees the public board
// PLUS their own private slice; `Table` is the shared spectator / board view
// (couch mode) — no private slice, and no player identity required. The tag is
// the seam a future per-audience event redaction would switch on too.

/** A single player's audience — public board plus their own private slice. */
export const PlayerAudience = Schema.TaggedStruct( "swish/Player", { id: PlayerId } );

/** The shared spectator/couch audience — public board only, no player identity. */
export const TableAudience = Schema.TaggedStruct( "swish/Table", {} );

/** Who a view is rendered for: a specific `Player` or the shared `Table`. */
export type Audience = typeof Audience.Type;
export const Audience = Schema.Union( [ PlayerAudience, TableAudience ] );

/**
 * Constructs a `Player` audience — the public board plus that player's private slice.
 * @param id - The player the view is rendered for.
 * @returns A `swish/Player` audience.
 */
export const playerAudience = ( id: PlayerId ) => PlayerAudience.make( { id } );

/**
 * Constructs the `Table` audience — the shared spectator/couch view, no private slice.
 * @returns A `swish/Table` audience.
 */
export const tableAudience = () => TableAudience.make( {} );

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

/** The minimum a per-player view carries: whose view it is. Games extend it. */
export type BasePlayerView = typeof BasePlayerView.Type;
export const BasePlayerView = Schema.Struct( {
	playerId: PlayerId
} );

/** The game-agnostic envelope fields common to every persisted/wire record. */
export type BaseGameData = typeof BaseGameData.Type;
export const BaseGameData = Schema.Struct( {
	id: GameId,
	code: GameCode,
	players: Schema.Record( PlayerId, PlayerInfo ),
	status: GameStatus,
	context: GameContext
} );

/** The decoded shape of an `initialize` payload for a game with the given config. */
export type InitializeInput<Config extends BaseGameConfig> = {
	id: GameId;
	code: GameCode;
	config: Config;
	seed?: string;
};

/**
 * Builds the `initialize` payload schema, weaving the game's `config` schema into
 * the fixed fields (id, code, optional seed).
 * @param config - The game's config schema.
 * @returns The `swish/InitializeInput` schema for this game.
 */
export const InitializeInput = <Config extends Schema.Top>( config: Config ) =>
	Schema.TaggedStruct(
		"swish/InitializeInput",
		{ id: GameId, code: GameCode, config, seed: Schema.optional( Schema.String ) }
	);

/** The response to `initialize`: the new game's id. */
export type InitializeResponse = typeof InitializeResponse.Type;
export const InitializeResponse = Schema.TaggedStruct(
	"swish/InitializeResponse",
	{ id: GameId }
);

/** The `join` payload: the game `code` to join and the joining `playerInfo`. */
export type JoinGameInput = typeof JoinGameInput.Type;
export const JoinGameInput = Schema.TaggedStruct(
	"swish/JoinGameInput",
	{ code: GameCode }
);

/** The response to `join`: the joined game's id and code. */
export type JoinGameResponse = typeof JoinGameResponse.Type;
export const JoinGameResponse = Schema.TaggedStruct(
	"swish/JoinGameResponse",
	{ id: GameId, code: GameCode }
);

/** The path params for per-game endpoints: the `gameId`. */
export type GameIdParams = typeof GameIdParams.Type;
export const GameIdParams = Schema.Struct( { gameId: GameId } );

// --- Generic, game-parameterised schema factories --------------------------
// The engine never hard-codes a game's state/config/view shapes; a game passes
// its own schemas and these factories weave them into the persisted record and
// the per-request snapshot.

/**
 * Builds the schema of the full record persisted to Durable Object storage under
 * one key, weaving the game's `state` and `config` schemas into the fixed envelope
 * (seed, id, code, status, context, players).
 * @param state - The game's state schema.
 * @param config - The game's config schema.
 * @returns The `swish/PersistedGameData` schema for this game.
 */
export const PersistedGameData = <State extends Schema.Top, Config extends Schema.Top>(
	state: State,
	config: Config
) =>
	Schema.TaggedStruct( "swish/PersistedGameData", {
		seed: Schema.optional( Schema.String ),
		id: GameId,
		code: GameCode,
		status: GameStatus,
		context: GameContext,
		players: Players,
		config,
		state
	} );

/** The decoded shape of the full persisted record (the value `PersistedGameData(...)` decodes to). */
export type PersistedGameData<State, Config> = {
	readonly _tag: "swish/PersistedGameData";
	readonly seed?: string;
	readonly id: GameId;
	readonly code: GameCode;
	readonly status: GameStatus;
	readonly context: GameContext;
	readonly players: Players;
	readonly config: Config;
	readonly state: State;
};

/**
 * Builds the schema of what a client receives from `getState` / after a move: the
 * envelope (id, code, status, context, players) plus the game's `config` and the
 * audience-appropriate `view`.
 * @param view - The game's view schema.
 * @param config - The game's config schema.
 * @returns The `swish/GameSnapshot` schema for this game.
 */
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

/** The decoded shape of a client snapshot (the value `GameSnapshot(...)` decodes to). */
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
// Canonical end-of-game result: a ranking + optional winner, computed by
// a game's `resolveResults` on completion so every UI (and the couch winner
// screen) renders placement without re-deriving it.

/** One player's placement in the final result: `rank`, optional `score` and `team`. */
export type Standing = typeof Standing.Type;
export const Standing = Schema.Struct( {
	playerId: PlayerId,
	rank: Schema.Number,
	score: Schema.optional( Schema.Number ),
	team: Schema.optional( Schema.String )
} );

/** The canonical end-of-game result: a `ranking` and an optional outright `winner`. */
export type Standings = typeof Standings.Type;
export const Standings = Schema.Struct( {
	ranking: Schema.Array( Standing ),
	winner: Schema.optional( PlayerId )
} );

// --- Action feed -----------------------------------------------------------
// A structured, human-readable log entry derived from the event stream:
// the TV ticker / chat feed / debugging feed. `at`/`actor` come from the commit;
// `text` from the game's `describe`. Redaction-safe by construction.

/**
 * One action-feed line: the commit's timestamp (`at`) and optional `actor`, the
 * event `kind`, and the human-readable `text` from the game's `describe`.
 */
export type LogEntry = typeof LogEntry.Type;
export const LogEntry = Schema.Struct( {
	at: Schema.Number,
	actor: Schema.optional( PlayerId ),
	kind: Schema.String,
	text: Schema.String
} );

/** The action feed: an ordered array of `LogEntry`. */
export type GameLog = typeof GameLog.Type;
export const GameLog = Schema.Array( LogEntry );

/**
 * The metadata recorded on each commit: the originating `command`, and the optional
 * `actor`, `moveType`, and idempotency `requestId`.
 */
export type CommitMeta = typeof CommitMeta.Type;
export const CommitMeta = Schema.Struct( {
	command: Schema.String,
	actor: Schema.optionalKey( PlayerId ),
	moveType: Schema.optionalKey( Schema.String ),
	requestId: Schema.optionalKey( Schema.String )
} );

/**
 * The decoded shape of a move request: the acting `playerInfo`, the move's `input`,
 * and the optional `requestId`/`expectedTurn` guards.
 */
export type MovePayload<In extends Schema.Top> = {
	readonly input: In[ "Type" ];
	readonly requestId?: string;
	readonly expectedTurn?: number;
};

/**
 * Builds the payload schema of a move request: the acting `playerInfo`, the move's
 * `input`, and the optional `requestId` (idempotency) / `expectedTurn` (optimistic
 * concurrency) guards the engine reads in `submitMove`.
 * @param input - The move's input payload schema.
 * @returns The move payload schema.
 */
export const MovePayload = <In extends Schema.Top>( input: In ) =>
	Schema.Struct( {
		input,
		requestId: Schema.optionalKey( Schema.String ),
		expectedTurn: Schema.optionalKey( Schema.Number )
	} );

/**
 * Builds the schema archived to KV when a game completes: the shared table view,
 * every player's view, and optional end-of-game `results` (standings).
 * @param view - The game's view schema (reused for table and per-player views).
 * @returns The `swish/CompletedGameData` schema for this game.
 */
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
