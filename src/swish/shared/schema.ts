import * as Schema from "effect/Schema";

import { UserId } from "@/auth/shared/schema.ts";

export const PositiveInt = Schema.Int.check( Schema.isGreaterThanOrEqualTo( 0 ) );

// --- Branded Ids -----------------------------------------------------------

export type PlayerId = typeof PlayerId.Type;
export const PlayerId = Schema.NonEmptyString.pipe(
	Schema.brand( "UserId" ),
	Schema.brand( "PlayerId" )
);

export type GameId = typeof GameId.Type;
export const GameId = Schema.NonEmptyString.pipe( Schema.brand( "GameId" ) );

export type GameCode = typeof GameCode.Type;
export const GameCode = Schema.NonEmptyString.pipe( Schema.brand( "GameCode" ) );

export type TeamId = typeof TeamId.Type;
export const TeamId = Schema.NonEmptyString.pipe( Schema.brand( "TeamId" ) );

export type TeamName = typeof TeamName.Type;
export const TeamName = Schema.NonEmptyString.check( Schema.isMaxLength( 32 ) );


// --- Enumerations ----------------------------------------------------------

/**
 * The game's lifecycle status:
 * - CREATED: Initial status of any game
 * - PLAYERS_READY: Required number of players have joined the game
 * - IN_PROGRESS: The game is started and players can make their moves
 * - COMPLETED: The game is completed
 */
export type GameStatus = typeof GameStatus.Type;
export const GameStatus = Schema.Literals( [
	"CREATED",
	"PLAYERS_READY",
	"IN_PROGRESS",
	"COMPLETED"
] );

/**
 * Denotes the current status of a player's seat in the game.
 * - active: Player is active and is playing
 * - folded: Player has withdrawn from the current deal and cannot make any moves
 * - eliminated: Player is knocked out and cannot make any moves
 * - out: Player has left the table and cannot make any moves
 *
 * A seat handed over to the bot policy keeps its status: autoplay is scheduling,
 * not seating, and is tracked outside the commit log.
 */
export type SeatStatus = typeof SeatStatus.Type;
export const SeatStatus = Schema.Literals( [ "active", "folded", "eliminated", "out" ] );

/**
 * Defined how a reaction window collects responses.
 * - sequential - Players react in a sequential order
 * - simultaneous - Players can react in any order
 */
export type InteractionMode = typeof InteractionMode.Type;
export const InteractionMode = Schema.Literals( [ "sequential", "simultaneous" ] );


// --- Players Related Structs ----------------------------------------------

/**
 * A player (or bot) at the table
 * - id: Player's id derived from user's id
 * - name: Player's name derived from user's name
 * - avatar: Player's avatar derived from user's image
 * - isBot: true if the player is a bot else false
 */
export type PlayerInfo = typeof PlayerInfo.Type;
export const PlayerInfo = Schema.Struct( {
	id: PlayerId,
	name: Schema.NonEmptyString,
	avatar: Schema.NonEmptyString,
	isBot: Schema.optional( Schema.Boolean )
} );

/**
 * The roster: a map of player id → `PlayerInfo`.
 */
export type Roster = typeof Roster.Type;
export const Roster = Schema.Record( PlayerId, PlayerInfo );


// --- Reaction / Interaction windows ----------------------------------------

/**
 * Some game moves require interaction with other players. Other players
 * respond to your move by another move which is usually out of turn.
 * An Interaction Frame is a priority window which can be opened after a move.
 * When an interaction frame is active, the moves are routed as part of
 * the interaction and do not change the current active player.
 *
 * - kind: The type of interaction window
 * - initiator: The player who opened this window by playing some move
 * - responders: The players who can respond to the intiator's move
 * - responses: Map of playerId to the player's response to a move
 * - mode: The way responders react to move (sequentially or simmultaneously)
 * - target: Optional player against whom responders take action
 * - payload: Optional payload to attach to a frame
 * - deadline: Optional timeout of this frame, after which it automatically closes
 */
export type InteractionFrame = typeof InteractionFrame.Type;
export const InteractionFrame = Schema.Struct( {
	kind: Schema.NonEmptyString,
	initiator: PlayerId,
	responders: Schema.Array( PlayerId ),
	mode: InteractionMode,
	responses: Schema.Record( PlayerId, Schema.Unknown ),
	target: Schema.optional( PlayerId ),
	payload: Schema.optional( Schema.Unknown ),
	deadline: Schema.optional( Schema.Number )
} );


// --- Game Context ----------------------------------------------------------

/**
 * The Context is used to track the flow of the game.
 * Managed internally by the engine ONLY.
 *
 * - turn: Counter denoting number of turns, starts with 0
 * - players: Ordered list of players
 * - currentPlayer: Denotes the player who can make moves (excluding interactions)
 * - phase: Current active phase of the game
 * - seats: Hold the seat status for a player. If not present, player is active.
 * - teams: Holds the team a player belongs to. Empty for a game without teams.
 * - teamNames: Holds the name a side chose for itself. Absent means it never named one.
 * - interactions: A stack of interactions. Interactions can be started from another interaction.
 * 			Maintains a stack where the top (latest) interaction needs to be resolved first.
 *
 * `players` is the seating order, not the join order: a team game rewrites it at
 * `start` so the sides interleave, which is what makes the default round-robin
 * alternate them.
 */
export type GameContext = typeof GameContext.Type;
export const GameContext = Schema.Struct( {
	turn: PositiveInt,
	players: Schema.Array( PlayerId ),
	currentPlayer: PlayerId,
	phase: Schema.optional( Schema.NonEmptyString ),
	interactions: Schema.Array( InteractionFrame ),
	seats: Schema.Record( PlayerId, SeatStatus ),
	teams: Schema.Record( PlayerId, TeamId ),
	teamNames: Schema.Record( TeamId, TeamName )
} );


// --- Standings -------------------------------------------------------------

/**
 * Denotes position of a player after the game is completed.
 * - playerId: Id of the player
 * - rank: Rank of the player
 * - score: Points scored by the player (optional)
 * - team: Team the player belongs to (optional)
 */
export type Standing = typeof Standing.Type;
export const Standing = Schema.Struct( {
	playerId: PlayerId,
	rank: PositiveInt,
	score: Schema.optional( Schema.Number ),
	team: Schema.optional( TeamId )
} );

/**
 * Denotes position of a team after a team game is completed.
 * - team: Id of the team
 * - rank: Rank of the team
 * - score: Points scored by the team (optional)
 */
export type TeamStanding = typeof TeamStanding.Type;
export const TeamStanding = Schema.Struct( {
	team: TeamId,
	rank: PositiveInt,
	score: Schema.optional( Schema.Number )
} );

/**
 * Compiled Standings of the game.
 * - ranking: List of player standings in the order of the ranks
 * - winner: The id of the winning player
 * - teamRanking: List of team standings in the order of the ranks (team games only)
 * - winningTeam: The id of the winning team (team games only)
 *
 * A team game's verdict is `winningTeam`: `winner` names a single player and has
 * no meaning when a side wins together, so the engine leaves it unset there.
 */
export type Standings = typeof Standings.Type;
export const Standings = Schema.Struct( {
	ranking: Schema.Array( Standing ),
	winner: Schema.optional( PlayerId ),
	teamRanking: Schema.optional( Schema.Array( TeamStanding ) ),
	winningTeam: Schema.optional( TeamId )
} );


// --- Base Game Info --------------------------------------------------

/**
 * The minimum every game config must provide.
 * - playerCount: Number of seats in a game
 * - autoStart: Denotes if the game needs to be started automatically
 * - moveTimeoutMillis: How long a human seat may hold its turn. Absent means no clock.
 * - interactionTimeoutMillis: Default lifetime of a reaction window, overridable per kind.
 * - teams: The sides this game is played in, in order. Absent means no teams.
 *
 * `teams` is what opts a game into partnerships. Sides are equal-sized, so
 * `playerCount` must divide by however many there are, and there must be at least
 * two — `initialize` refuses anything else with `InvalidTeamConfig`. A game may
 * narrow the ids the way it narrows `playerCount`.
 */
export type BaseGameConfig = typeof BaseGameConfig.Type;
export const BaseGameConfig = Schema.Struct( {
	playerCount: PositiveInt,
	autoStart: Schema.Boolean,
	moveTimeoutMillis: Schema.optional( PositiveInt ),
	interactionTimeoutMillis: Schema.optional( PositiveInt ),
	teams: Schema.optional( Schema.Array( TeamId ) )
} );

/**
 * The metadata every form of a game carries, whatever the audience.
 * The seed is deliberately not here: it belongs to the `GameRecord` alone.
 * - id: Id of the game
 * - code: Code of the game
 * - version: Number denoting the number of commits that happened to the game data
 * - players: Roster of the players in the game
 * - status: Status of the game
 * - context: The context of a game.
 * - results: Optional results filled when game is completed
 */
export type GameHeader = typeof GameHeader.Type;
export const GameHeader = Schema.Struct( {
	id: GameId,
	code: GameCode,
	version: PositiveInt,
	players: Roster,
	status: GameStatus,
	context: GameContext,
	results: Schema.optional( Standings )
} );

/**
 * All game events must have a tag of BaseGameEventTag type.
 */
export type BaseGameEvent = typeof BaseGameEvent.Type;
export const BaseGameEvent = Schema.Struct( { _tag: Schema.String } );

/**
 * Builds the schema of the data passed to structure methods
 * - state: The state of the game
 * - config: The config of the game
 * - context: The context of the game
 *
 * @param state - The game's state schema.
 * @param config - The game's config schema.
 * @returns The `GameData` schema for this game.
 */
export const GameData =
	<State extends Schema.Top, Config extends Schema.Top>( state: State, config: Config ) =>
		Schema.Struct( { state, config, context: GameContext } );

export type GameData<State, Config extends BaseGameConfig> = {
	readonly state: State;
	readonly config: Config;
	readonly context: GameContext;
};

// --- Audiences -------------------------------------------------------------

/**
 * The shared audience: everything an observer of the table may see.
 */
export type TableAudience = typeof TableAudience.Type;
export const TableAudience = Schema.TaggedStruct( "swish/TableAudience", {} );

/**
 * A seated player's audience: the table, plus whatever is private to them.
 */
export type PlayerAudience = typeof PlayerAudience.Type;
export const PlayerAudience = Schema.TaggedStruct(
	"swish/PlayerAudience",
	{ playerId: PlayerId }
);

/**
 * Who a view is being built for. A game's `view` redacts against this, so one
 * view schema serves spectators and players alike.
 */
export type Audience = typeof Audience.Type;
export const Audience = Schema.Union( [ TableAudience, PlayerAudience ] );

/**
 * The view's fields with `playerId` made required. Spelled out rather than left
 * to the spread: TypeScript computes a spread over a *generic* field record
 * eagerly, and collapses the optional `playerId` it already holds to `undefined`
 * instead of letting the required one that follows win.
 */
type SeatFields<Fields extends Schema.Struct.Fields> =
	Omit<Fields, "playerId"> & { readonly playerId: typeof PlayerId };

/**
 * A game's view as the audience that *is* a seat holds it: the same shape, with
 * `playerId` no longer optional.
 *
 * Every view declares `playerId` optional because one schema serves both
 * audiences — `view` fills it from `playerIdFor`, which hands back `undefined`
 * for the table. That leaves everyone who has *already* established they are
 * looking at a seat — a client past its own null check, a bot policy the engine
 * only ever hands its own seat's view — null-checking a field that cannot be
 * absent for them. This is the schema counterpart of {@link PlayerAudience}: the
 * narrowing written once, rather than a type alias per game.
 *
 * A `Struct` rather than a form of its own, and no wider than the view it came
 * from: there is still exactly one view on the wire. This says which of its
 * audiences you have in hand.
 *
 * @param view - The game's view schema.
 * @returns The same fields, with `playerId` required.
 */
export const SeatView = <Fields extends Schema.Struct.Fields>( view: Schema.Struct<Fields> ) =>
	Schema.Struct( { ...view.fields, playerId: PlayerId } as SeatFields<Fields> );


/**
 * Points at a game. Returned by both create and join, which answer the same
 * question — which game, and what code do I share to fill it.
 * - id: Id of the game
 * - code: Code used to join the game
 */
export type GameRef = typeof GameRef.Type;
export const GameRef = Schema.Struct( { id: GameId, code: GameCode } );

// --- Game Forms ------------------------------------------------------------

/**
 * Builds the schema of the authoritative record — the form the engine stores
 * and folds events into. Holds the unredacted `state` and the `seed`, and
 * never leaves the engine.
 *
 * @param state - The game's state schema.
 * @param config - The game's config schema.
 * @returns The `swish/GameRecord` schema for this game.
 */
export const GameRecord =
	<State extends Schema.Top, Config extends Schema.Top>( state: State, config: Config ) =>
		Schema.Struct( {
			...GameHeader.fields,
			seed: Schema.NonEmptyString,
			config,
			state
		} );

export type GameRecord<State, Config extends BaseGameConfig> = GameHeader & {
	readonly seed: string;
	readonly state: State;
	readonly config: Config;
};

/**
 * Builds the schema handed to a client: the game as one audience sees it. The
 * record minus the seed, with `state` replaced by the view built for that
 * audience. This is the only game shape that crosses the wire.
 *
 * It also carries the three facts the engine keeps beside a game rather than
 * inside it — who has handed their seat to the bot policy, when the pending
 * actor's clock runs out, and which game this table agreed to play next. None
 * of them is folded state, so none lives on the record or in the commit log;
 * the envelope is where a client learns them.
 *
 * `rematch` is what carries one player's decision to the rest of the table. It
 * rides the envelope rather than the view precisely because every audience
 * needs it: a television is attached to the table audience, and a rematch
 * redacted out of its view would leave the shared screen sitting on a finished
 * game while every phone in the room had moved on.
 *
 * @param view - The game's view schema.
 * @param config - The game's config schema.
 * @returns The `swish/GameView` schema for this game.
 */
export const GameView =
	<View extends Schema.Top, Config extends Schema.Top>( view: View, config: Config ) =>
		Schema.Struct( {
			...GameHeader.fields,
			config,
			view,
			autoPlay: Schema.Record( PlayerId, Schema.Boolean ),
			deadline: Schema.optional( Schema.Number ),
			rematch: Schema.optional( GameRef )
		} );

export type GameView<View, Config extends BaseGameConfig> = GameHeader & {
	readonly view: View;
	readonly config: Config;
	readonly autoPlay: Record<PlayerId, boolean>;
	readonly deadline?: number;
	readonly rematch?: GameRef;
};

/**
 * Builds the schema written to cold storage when a game completes: the table
 * view, plus the final view each player held.
 *
 * @param view - The game's view schema.
 * @param config - The game's config schema.
 * @returns The `swish/ArchivedGame` schema for this game.
 */
export const ArchivedGame =
	<View extends Schema.Top, Config extends Schema.Top>( view: View, config: Config ) =>
		Schema.Struct( {
			...GameHeader.fields,
			config,
			view,
			playerViews: Schema.Record( PlayerId, view )
		} );

export type ArchivedGame<View, Config extends BaseGameConfig> = GameHeader & {
	readonly view: View;
	readonly playerViews: Record<PlayerId, View>;
	readonly config: Config;
};


// --- API Inputs & Responses ---------------------------------------------

/**
 * The minimum input required to initialize any game.
 * - id: Id of the game
 * - code: GameCode used to join any game
 * - creator: The user creating the game, seated as the first current player
 */
export type BaseInitializeInput = typeof BaseInitializeInput.Type;
export const BaseInitializeInput = Schema.Struct( {
	id: GameId,
	code: GameCode,
	creator: UserId
} );

/**
 * Builds the InitializeInput given the config schema.
 * Extends BaseInitializeInput
 * - config: The config of that game
 *
 * @param config - The game's config schema.
 * @returns The `swish/InitializeInput` schema for this game.
 */
export const InitializeInput = <Config extends Schema.Top>( config: Config ) =>
	Schema.Struct( { ...BaseInitializeInput.fields, config } );

export type InitializeInput<Config extends BaseGameConfig> = BaseInitializeInput & {
	config: Config;
};

/**
 * The input required to join a game. The player joining
 * is extracted from the authentication information.
 * - code: Code of the game
 */
export type JoinGameInput = typeof JoinGameInput.Type;
export const JoinGameInput = Schema.Struct( { code: GameCode } );

/**
 * The input required to take a side, or move to another one. The seat being
 * assigned is the caller's own, extracted from the authentication information.
 * - team: The side to take
 */
export type JoinTeamInput = typeof JoinTeamInput.Type;
export const JoinTeamInput = Schema.Struct( { team: TeamId } );

/**
 * The input required to name a side. The caller must already be on it, and it
 * must not be named yet — a name is chosen once and never changed.
 * - team: The side being named
 * - name: What it calls itself
 */
export type NameTeamInput = typeof NameTeamInput.Type;
export const NameTeamInput = Schema.Struct( { team: TeamId, name: TeamName } );

/**
 * The input required to hand a seat to the bot policy, or to take it back. The
 * seat being switched is the caller's own, extracted from the authentication
 * information.
 * - enabled: `true` to let the game's `botMove` play this seat
 */
export type SetAutoPlayInput = typeof SetAutoPlayInput.Type;
export const SetAutoPlayInput = Schema.Struct( { enabled: Schema.Boolean } );

/**
 * The input required to start a rematch: another game of the same kind, with
 * the same config and the same people around it.
 * - keepTeams: `true` to seat everyone back on the side they just played
 *
 * A game without sides ignores the flag rather than being given an endpoint of
 * its own. In one with them the choice is real and cannot be deferred: seats
 * carried over come back full, so `false` is what leaves the new lobby free to
 * form its sides again.
 */
export type RematchInput = typeof RematchInput.Type;
export const RematchInput = Schema.Struct( { keepTeams: Schema.Boolean } );

/**
 * The path params for per-game endpoints: the `gameId`.
 */
export type GameIdParams = typeof GameIdParams.Type;
export const GameIdParams = Schema.Struct( { gameId: GameId } );


// --- Engine events ---------------------------------------------------------

/**
 * Emitted when a player joins a game.
 * Adds the player to the roster.
 */
export const PlayerJoined = Schema.TaggedStruct(
	"swish/ev/PlayerJoined",
	{ player: PlayerInfo }
);

/**
 * Emitted when a player takes a side — picked in the lobby, or handed to them by
 * the balancing `start` runs. Records the team for that player in the context.
 */
export type TeamAssigned = typeof TeamAssigned.Type;
export const TeamAssigned = Schema.TaggedStruct(
	"swish/ev/TeamAssigned",
	{ playerId: PlayerId, team: TeamId }
);

/**
 * Emitted when a player steps off the side they were on. Clears their team in
 * the context, leaving the seat unassigned rather than moving it somewhere else.
 *
 * The inverse of `TeamAssigned`, and needed as its own event because sides are
 * equal-sized: a seat can only move to a side with room, so the only way out of
 * a full one is to leave it first and let someone take the space.
 */
export type TeamLeft = typeof TeamLeft.Type;
export const TeamLeft = Schema.TaggedStruct(
	"swish/ev/TeamLeft",
	{ playerId: PlayerId }
);

/**
 * Emitted when a side names itself. Records the name against that team.
 *
 * A side is named at most once — `nameTeam` refuses a side that already has one —
 * so this event never overwrites, and the name a game ends with is the one folded
 * the first time it appeared.
 */
export type TeamNamed = typeof TeamNamed.Type;
export const TeamNamed = Schema.TaggedStruct(
	"swish/ev/TeamNamed",
	{ team: TeamId, name: TeamName }
);

/**
 * Emitted once, by `start`, when a team game seats its sides so they interleave.
 * Replaces the seating order in the context.
 *
 * The order is always a permutation of the players already seated — it is built by
 * re-arranging that very array — so every seat survives. That matters because the
 * order is what `buildViews` walks to build each player's view: a seat missing from
 * it would silently be served the table view instead of its own.
 */
export type SeatOrderSet = typeof SeatOrderSet.Type;
export const SeatOrderSet = Schema.TaggedStruct(
	"swish/ev/SeatOrderSet",
	{ order: Schema.Array( PlayerId ) }
);

/**
 * Sets the current player in the context
 * to the provided player id
 */
export const CurrentPlayerSet = Schema.TaggedStruct(
	"swish/ev/CurrentPlayerSet",
	{ playerId: PlayerId }
);

/**
 * Increments the turn counter at the end of a turn-ending move.
 */
export const TurnAdvanced = Schema.TaggedStruct( "swish/ev/TurnAdvanced", {} );

/**
 * Emmitted when the game enters a phase.
 * Updates the phase in context to the one provided.
 */
export const PhaseEntered = Schema.TaggedStruct(
	"swish/ev/PhaseEntered",
	{ phase: Schema.NonEmptyString }
);

/**
 * Emitted when the game exits a phase.
 * Does not update anything. For game change log.
 */
export const PhaseExited = Schema.TaggedStruct(
	"swish/ev/PhaseExited",
	{ phase: Schema.NonEmptyString }
);

/**
 * Emitted when the game transitions from one status to another.
 * Updates the status of the game.
 */
export const StatusChanged = Schema.TaggedStruct(
	"swish/ev/StatusChanged",
	{ status: GameStatus }
);

/**
 * Emitted when the game completes.
 * Usually the last event for a game.
 */
export const GameCompleted = Schema.TaggedStruct(
	"swish/ev/GameCompleted",
	{}
);

/**
 * Emitted just before `GameCompleted` when the structure defines
 * `resolveResults`. Records the final standings on the game data.
 */
export type ResultsResolved = typeof ResultsResolved.Type;
export const ResultsResolved = Schema.TaggedStruct(
	"swish/ev/ResultsResolved",
	{ results: Standings }
);

/**
 * Emitted when a particular move opens a reaction window.
 * Pushes the provided interaction frame to the stack in the context
 */
export type InteractionOpened = typeof InteractionOpened.Type;
export const InteractionOpened = Schema.TaggedStruct(
	"swish/ev/InteractionOpened",
	{ frame: InteractionFrame }
);

/**
 * Emitted when a responder makes a move and an interaction
 * frame is opened. Updates the responses in the interaction frame.
 */
export const InteractionResponded = Schema.TaggedStruct(
	"swish/ev/InteractionResponded",
	{ playerId: PlayerId, response: Schema.Unknown }
);

/**
 * Emitted when an interaction is resolved.
 * i.e. Responses have been recorded for that interaction
 * and now the game can move to the next player
 */
export const InteractionResolved = Schema.TaggedStruct( "swish/ev/InteractionResolved", {} );

/**
 * Emitted when the seat status of a player changes.
 * Updates the seat status for that player in context.
 */
export type SeatStatusChanged = typeof SeatStatusChanged.Type;
export const SeatStatusChanged = Schema.TaggedStruct(
	"swish/ev/SeatStatusChanged",
	{ playerId: PlayerId, status: SeatStatus }
);

/**
 * Union of all the built in events handled by the engine
 */
export type EngineEvent = typeof EngineEvent.Type;
export const EngineEvent = Schema.Union( [
	PlayerJoined,
	TeamAssigned,
	TeamLeft,
	TeamNamed,
	SeatOrderSet,
	CurrentPlayerSet,
	TurnAdvanced,
	PhaseEntered,
	PhaseExited,
	StatusChanged,
	GameCompleted,
	ResultsResolved,
	InteractionOpened,
	InteractionResponded,
	InteractionResolved,
	SeatStatusChanged
] );

/**
 * Builds the schema for combined events in a game
 * Both engine events and state events.
 * @param ev - The Schema for state events
 */
export const GameEvent = <Ev extends Schema.Top>( ev: Ev ) =>
	Schema.Union( [ EngineEvent, ev ] );


// --- Commit Metadata -----------------------------------------------------------

/**
 * The metadata recorded on each commit.
 * - command: Command after which the commit happened.
 * - actor: Optional player whose action resulted in this commit
 * - moveType: The type of move that made this commit
 */
export type CommitMeta = typeof CommitMeta.Type;
export const CommitMeta = Schema.Struct( {
	command: Schema.NonEmptyString,
	actor: Schema.optionalKey( PlayerId ),
	moveType: Schema.optionalKey( Schema.NonEmptyString )
} );

/**
 * Builds the schema of a commit — one command's batch of events plus its metadata
 * Extends CommitMeta.
 * - id: Id of the commit
 * - at: Timmestamp of commit
 * - events: List of engine events and game events part of the commit
 *
 * @param ev - The game's event schema, woven into the commit's event array.
 * @returns The commit schema for this game.
 */
export const EventsCommit = <Ev extends Schema.Top>( ev: Ev ) =>
	Schema.Struct( {
		id: Schema.NonEmptyString,
		at: Schema.Number,
		events: Schema.Array( GameEvent( ev ) ),
		...CommitMeta.fields
	} );


// --- Game Errors ---------------------------------------------

/**
 * The game is already at capacity; a further `Join` is rejected.
 */
export class GameFull extends Schema.TaggedError<GameFull>()(
	"swish/GameFull",
	{ playerCount: Schema.Number }
) {}

/**
 * This player already holds a seat in the game.
 */
export class AlreadyJoined extends Schema.TaggedError<AlreadyJoined>()(
	"swish/AlreadyJoined",
	{ playerId: PlayerId }
) {}

/**
 * The game has already started (or finished), so no further seats may be taken.
 */
export class GameNotJoinable extends Schema.TaggedError<GameNotJoinable>()(
	"swish/GameNotJoinable",
	{ status: Schema.String }
) {}

/**
 * A move/lifecycle action requires an IN_PROGRESS game but it is not.
 */
export class GameNotInProgress extends Schema.TaggedError<GameNotInProgress>()(
	"swish/GameNotInProgress",
	{ status: Schema.String }
) {}

/**
 * The game cannot start yet (not full / already started).
 */
export class CannotStart extends Schema.TaggedError<CannotStart>()(
	"swish/CannotStart",
	{ status: Schema.String }
) {}

/**
 * It is not this player's turn, and the move defines no custom `canMove`.
 */
export class NotYourTurn extends Schema.TaggedError<NotYourTurn>()(
	"swish/NotYourTurn",
	{ playerId: PlayerId, currentPlayer: PlayerId }
) {}

/**
 * The requested move is not available in the current (flat or phase) rule set.
 */
export class MoveNotAllowed extends Schema.TaggedError<MoveNotAllowed>()(
	"swish/MoveNotAllowed",
	{ move: Schema.String }
) {}

/**
 * A move's `validate` rejected the input. Games raise this from `validate`.
 */
export class InvalidMove extends Schema.TaggedError<InvalidMove>()(
	"swish/InvalidMove",
	{ move: Schema.String, reason: Schema.String }
) {}

/**
 * No persisted state was found for this Durable Object (never initialised).
 */
export class GameNotFound extends Schema.TaggedError<GameNotFound>()(
	"swish/GameNotFound",
	{ id: Schema.optionalKey( GameId ), code: Schema.optionalKey( GameCode ) }
) {}

/**
 * The caller is not a seated player in this game. Every command except
 * `initialize`/`join` asserts membership from the authenticated identity, so a
 * non-member can neither read a private view nor act on a game they haven't joined.
 */
export class NotAMember extends Schema.TaggedError<NotAMember>()(
	"swish/NotAMember",
	{ playerId: PlayerId },
	{ httpApiStatus: 403 }
) {}

/**
 * A phased structure referenced a phase name that does not exist.
 */
export class PhaseNotFound extends Schema.TaggedError<PhaseNotFound>()(
	"swish/PhaseNotFound",
	{ phase: Schema.String }
) {}

/**
 * Persisted state failed to decode against the current schema.
 */
export class CorruptState extends Schema.TaggedError<CorruptState>()(
	"swish/CorruptState",
	{ id: Schema.optionalKey( GameId ), reason: Schema.String }
) {}

/**
 * `undo` was called but there is no move left to undo — either the game has not
 * started, or the cursor is already back at its opening position.
 * Undo is only possible after the game has started
 */
export class NothingToUndo extends Schema.TaggedError<NothingToUndo>()(
	"swish/NothingToUndo",
	{ cursor: Schema.Int }
) {}

/**
 * `redo` was called but the cursor is already at the newest commit.
 */
export class NothingToRedo extends Schema.TaggedError<NothingToRedo>()(
	"swish/NothingToRedo",
	{ cursor: Schema.Int }
) {}

/**
 * `undo` was refused because the commit at the cursor is not this player's move.
 * A player may only take back a move they played themselves, and only while it is
 * still the last thing that happened — anything committed on top of it (another
 * player's move, a bot's, a timeout) has to come off first, by whoever owns it.
 */
export class UndoNotAllowed extends Schema.TaggedError<UndoNotAllowed>()(
	"swish/UndoNotAllowed",
	{ playerId: PlayerId, cursor: Schema.Int },
	{ httpApiStatus: 403 }
) {}

/**
 * `redo` was refused because the commit ahead of the cursor is not this player's
 * move. Redo is undo's mirror: the move being replayed must belong to the player
 * asking for it.
 */
export class RedoNotAllowed extends Schema.TaggedError<RedoNotAllowed>()(
	"swish/RedoNotAllowed",
	{ playerId: PlayerId, cursor: Schema.Int },
	{ httpApiStatus: 403 }
) {}

/**
 * A seat cannot be handed to the bot policy because the game declares none.
 * Nothing could play the seat, so the request is refused rather than recorded
 * as a setting that does nothing.
 */
export class AutoPlayUnavailable extends Schema.TaggedError<AutoPlayUnavailable>()(
	"swish/AutoPlayUnavailable",
	{ game: Schema.String },
	{ httpApiStatus: 409 }
) {}

/**
 * A side was asked for in a game that declares none. Nothing could be assigned, so
 * the request is refused rather than recorded as a pick that means nothing.
 */
export class TeamsUnavailable extends Schema.TaggedError<TeamsUnavailable>()(
	"swish/TeamsUnavailable",
	{ game: Schema.String },
	{ httpApiStatus: 409 }
) {}

/**
 * The requested side is not one this game declares in `config.teams`.
 */
export class TeamNotFound extends Schema.TaggedError<TeamNotFound>()(
	"swish/TeamNotFound",
	{ team: Schema.String }
) {}

/**
 * The requested side already holds its share of the seats. Sides are equal-sized,
 * so taking one more would leave another short.
 */
export class TeamFull extends Schema.TaggedError<TeamFull>()(
	"swish/TeamFull",
	{ team: Schema.String, size: Schema.Number }
) {}

/**
 * The name offered for a side is not one `TeamName` accepts — empty, or past its
 * length cap. The HTTP layer decodes the payload before the engine sees it, so
 * this is the guard for a caller reaching the command directly.
 */
export class InvalidTeamName extends Schema.TaggedError<InvalidTeamName>()(
	"swish/InvalidTeamName",
	{ name: Schema.String }
) {}

/**
 * A side may only be named by someone playing on it.
 */
export class NotOnTeam extends Schema.TaggedError<NotOnTeam>()(
	"swish/NotOnTeam",
	{ playerId: PlayerId, team: Schema.String },
	{ httpApiStatus: 403 }
) {}

/**
 * That side already has a name. A name is chosen once and is not editable, so a
 * second attempt is refused rather than quietly replacing what is there.
 */
export class TeamAlreadyNamed extends Schema.TaggedError<TeamAlreadyNamed>()(
	"swish/TeamAlreadyNamed",
	{ team: Schema.String, name: Schema.String },
	{ httpApiStatus: 409 }
) {}

/**
 * The config declares teams the engine cannot seat: fewer than two sides,
 * duplicate ids, or a `playerCount` that does not divide evenly between them.
 * Raised by `initialize`, so a game that could never be seated is never stored.
 */
export class InvalidTeamConfig extends Schema.TaggedError<InvalidTeamConfig>()(
	"swish/InvalidTeamConfig",
	{ reason: Schema.String }
) {}

/**
 * A rematch was asked for on a game that has not finished. There is nothing to
 * play again yet, so the request is refused rather than quietly starting a
 * second game alongside one still in progress.
 */
export class RematchUnavailable extends Schema.TaggedError<RematchUnavailable>()(
	"swish/RematchUnavailable",
	{ status: Schema.String },
	{ httpApiStatus: 409 }
) {}

/**
 * Union of the errors a `getState` can surface to the client.
 */
export type GetStateError = typeof GetStateError.Type;
export const GetStateError = Schema.Union( [ NotAMember, GameNotFound, CorruptState ] );

/**
 * Union of the errors a `setAutoPlay` can surface to the client.
 */
export type AutoPlayError = typeof AutoPlayError.Type;
export const AutoPlayError = Schema.Union( [
	NotAMember,
	AutoPlayUnavailable,
	GameNotFound,
	CorruptState
] );

/**
 * Union of the errors a `join` can surface to the client. Includes the team
 * errors, since a join may carry the side the player is taking.
 */
export type JoinError = typeof JoinError.Type;
export const JoinError = Schema.Union( [
	NotAMember,
	GameFull,
	AlreadyJoined,
	GameNotJoinable,
	GameNotFound,
	CorruptState,
	TeamsUnavailable,
	TeamNotFound,
	TeamFull
] );

/**
 * Union of the errors a `joinTeam` can surface to the client.
 */
export type TeamError = typeof TeamError.Type;
export const TeamError = Schema.Union( [
	NotAMember,
	TeamsUnavailable,
	TeamNotFound,
	TeamFull,
	GameNotJoinable,
	GameNotFound,
	CorruptState
] );

/**
 * Union of the errors a `nameTeam` can surface to the client.
 */
export type NameTeamError = typeof NameTeamError.Type;
export const NameTeamError = Schema.Union( [
	NotAMember,
	NotOnTeam,
	TeamAlreadyNamed,
	InvalidTeamName,
	TeamsUnavailable,
	TeamNotFound,
	GameNotJoinable,
	GameNotFound,
	CorruptState
] );

/**
 * Union of the errors creating a game can surface to the client. `join`'s errors
 * plus the ones only `initialize` can raise, so a bad team config does not have to
 * be declared on every plain join.
 */
export type InitializeError = typeof InitializeError.Type;
export const InitializeError = Schema.Union( [ JoinError, InvalidTeamConfig ] );

/**
 * Union of the errors a `start` can surface to the client.
 */
export type StartError = typeof StartError.Type;
export const StartError = Schema.Union( [
	NotAMember,
	CannotStart,
	AlreadyJoined,
	GameNotFound,
	CorruptState,
	PhaseNotFound
] );

/**
 * Union of the errors a `submitMove` can surface to the client.
 */
export type MoveError = typeof MoveError.Type;
export const MoveError = Schema.Union( [
	NotAMember,
	InvalidMove,
	NotYourTurn,
	MoveNotAllowed,
	GameNotInProgress,
	PhaseNotFound,
	GameNotFound,
	CorruptState
] );

/**
 * Union of the errors a `undo` can surface to the client.
 */
export type UndoError = typeof UndoError.Type;
export const UndoError = Schema.Union( [ NothingToUndo, UndoNotAllowed, GetStateError ] );

/**
 * Union of the errors a `redo` can surface to the client.
 */
export type RedoError = typeof RedoError.Type;
export const RedoError = Schema.Union( [ NothingToRedo, RedoNotAllowed, GetStateError ] );

/**
 * Union of the errors a `leaveTeam` can surface to the client. Stepping off a
 * side you are not on is not one of them: like `joinTeam` re-joining the side
 * you already hold, it is simply nothing happening.
 */
export type LeaveTeamError = typeof LeaveTeamError.Type;
export const LeaveTeamError = Schema.Union( [
	NotAMember,
	TeamsUnavailable,
	GameNotJoinable,
	GameNotFound,
	CorruptState
] );

/**
 * Union of the errors a `rematch` can surface to the client.
 *
 * Deliberately narrow. Building the next game can fail in every way creating one
 * can — a config the engine refuses, a seat it will not take, a side with no
 * room — but none of those is a thing the caller did: the config and the roster
 * came from a game this same engine accepted and ran to completion, so a failure
 * there is a bug in the rematch, not a decision to report. Those are `orDie`d at
 * the handler, and what is left is the three things a caller can actually get
 * wrong — asking about a game that is not there, one they never sat at, or one
 * that has not finished.
 */
export type RematchError = typeof RematchError.Type;
export const RematchError = Schema.Union( [ RematchUnavailable, GetStateError ] );
