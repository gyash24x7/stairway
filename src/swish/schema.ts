import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export const PositiveInt = Schema.Int.check( Schema.isGreaterThanOrEqualTo( 0 ) );

// --- Branded Ids -----------------------------------------------------------

export type PlayerId = typeof PlayerId.Type;
export const PlayerId = Schema.NonEmptyString.pipe(
	Schema.brand( "UserId" ),
	Schema.brand( "PlayerId" )
);

export type GameId = typeof GameId.Type;
export const GameId = Schema.NonEmptyString.pipe( Schema.brand( "GameId" ) );

export type CommitId = typeof CommitId.Type;
export const CommitId = Schema.NonEmptyString.pipe( Schema.brand( "CommitId" ) );

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


// --- Players Related Structs ----------------------------------------------

export type SwishUser = { id: string; name: string; avatar: string };

/**
 * A player (or bot) at the table
 * - id: Player's id derived from user's id
 * - name: Player's name derived from user's name
 * - avatar: Player's avatar derived from user's image
 * - isBot: true if the player is a bot else false
 */
export type PlayerInfo = typeof PlayerInfo.Type;
export const PlayerInfo = Schema.TaggedStruct( "swish/PlayerInfo", {
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


// --- Interaction Windows ---------------------------------------------------

/**
 * How a window decides it has heard enough:
 * - first: the first real answer wins and closes the window on everybody else.
 * 		A challenge race — once one opponent has challenged there is nothing left
 * 		for the others to say, and asking them anyway would leak how many were
 * 		about to.
 * - all: the window stays open until every responder has answered, passed or
 * 		run out of time. Simultaneous decisions — two players each choosing a card
 * 		to give up off the same failed challenge — settle together this way.
 */
export type InteractionResolution = typeof InteractionResolution.Type;
export const InteractionResolution = Schema.Literals( [ "first", "all" ] );

/**
 * How one responder left the window:
 * - answered: they played one of its moves
 * - passed: they declined, deliberately
 * - expired: the window closed with them still holding it
 *
 * The three are kept apart rather than collapsed into "no answer" because a game
 * reads them differently. Declining to challenge is a decision; timing out of a
 * decision that had to be made is not, and a game may want to pick for the seat
 * rather than treat silence as consent.
 */
export type InteractionOutcome = typeof InteractionOutcome.Type;
export const InteractionOutcome = Schema.Literals( [ "answered", "passed", "expired" ] );

/**
 * One answer a window will accept.
 * - move: The move name, which must be one of the moves the kind declares
 * - players: Who may play it. Absent means every responder may.
 *
 * `players` is what lets a single window ask two different questions at once.
 * Coup's assassination is the case: every opponent may challenge the claim, but
 * only the target may block it with a Contessa — one window, two options, two
 * audiences, rather than two windows racing each other.
 */
export type InteractionOption = typeof InteractionOption.Type;
export const InteractionOption = Schema.TaggedStruct( "swish/InteractionOption", {
	move: Schema.NonEmptyString,
	players: Schema.optional( Schema.Array( PlayerId ) )
} );

/**
 * What one responder said.
 * - playerId: Who answered
 * - move: The move they played. Absent when they passed or expired.
 * - outcome: How they left the window
 */
export type InteractionResponse = typeof InteractionResponse.Type;
export const InteractionResponse = Schema.TaggedStruct( "swish/InteractionResponse", {
	playerId: PlayerId,
	move: Schema.optional( Schema.NonEmptyString ),
	outcome: InteractionOutcome
} );

/**
 * One open question, and everything the engine needs to close it.
 *
 * A frame is the engine's half of an interaction window: who is being asked,
 * what they may answer, how long they have, and what counts as enough. The
 * *subject* — what the window is about — is deliberately not here. It lives in
 * the game's own state, written by the game's own events, which is what keeps
 * this schema game-agnostic: a frame never carries a payload the engine cannot
 * read.
 *
 * - id: Assigned at fold time from `context.interactionCount`, so it is stable
 * 		under replay and a client can tell one window from the next
 * - kind: Which of the game's declared windows this is; picks the `onResolve`
 * - initiator: Whose action opened it
 * - subject: Who it is about, when that is somebody other than the initiator —
 * 		the target of an assassination, the player losing an influence. Advisory:
 * 		the engine never reads it, but games and clients both want it named
 * - responders: Everyone asked, in seat order
 * - pending: Everyone who has not answered yet. The window is settled when empty
 * - responses: What has been said so far, in the order it was said
 * - options: The answers this window accepts, optionally narrowed per player
 * - resolution: What closes the window
 * - allowPass: Whether declining is one of the answers. `false` makes the window
 * 		mandatory — a card *must* be given up — and the timeout has to produce a
 * 		decision rather than a shrug
 * - secret: Whether answers are hidden from the other responders until the
 * 		window closes. Redacted in `viewFor`, per audience
 * - timeoutMillis: How long the window stays open. Absent means it waits forever,
 * 		which only makes sense for a window every responder is sure to answer
 * - openedAtTurn: The turn it was opened on, for the game's own bookkeeping
 */
export type InteractionFrame = typeof InteractionFrame.Type;
export const InteractionFrame = Schema.TaggedStruct( "swish/InteractionFrame", {
	id: Schema.NonEmptyString,
	kind: Schema.NonEmptyString,
	initiator: PlayerId,
	subject: Schema.optional( PlayerId ),
	responders: Schema.Array( PlayerId ),
	pending: Schema.Array( PlayerId ),
	responses: Schema.Array( InteractionResponse ),
	options: Schema.Array( InteractionOption ),
	resolution: InteractionResolution,
	allowPass: Schema.Boolean,
	secret: Schema.Boolean,
	timeoutMillis: Schema.optional( PositiveInt ),
	openedAtTurn: PositiveInt
} );

/**
 * The turn tail a window is holding up.
 * - actor: The player whose move opened the window
 * - moveType: The move they played
 *
 * Recorded when a turn-ending move suspends itself on a window, and read back
 * when the last window closes — the engine then runs that move's end-turn tail,
 * so the turn ends where the move said it would rather than where the last
 * responder happened to be sitting.
 */
export type SuspendedTurn = typeof SuspendedTurn.Type;
export const SuspendedTurn = Schema.TaggedStruct( "swish/SuspendedTurn", {
	actor: PlayerId,
	moveType: Schema.NonEmptyString
} );


// --- Game Context ----------------------------------------------------------

/**
 * The Context is used to track the flow of the game.
 * Managed internally by the engine ONLY.
 *
 * - turn: Counter denoting number of turns, starts with 0
 * - players: Ordered list of players in seating order
 * - currentPlayer: Denotes the player who can make moves. Absent until the first
 * 		seat is taken: `PlayerId` is a branded `NonEmptyString`, so an empty table
 * 		has no value to stand in, and `replay` has to be able to seed a record from
 * 		genesis alone — before any `PlayerJoined` has been folded
 * - phase: Current active phase of the game
 * - teams: Holds the team a player belongs to. Empty for a game without teams.
 * - teamNames: Holds the name a side chose for itself. Absent means it never named one.
 * - interactions: The open interaction windows, outermost first. The last entry
 * 		is the one being answered: a block opened inside a challenge window pushes
 * 		onto this rather than replacing it, and the stack unwinds as each settles
 * - interactionCount: How many windows this game has ever opened. The source of
 * 		frame ids, and monotonic so an id is never reused — a client holding a
 * 		stale frame id can always be told the window it is answering has gone
 * - suspended: The turn tail waiting on the stack, if a move suspended one
 */
export type GameContext = typeof GameContext.Type;
export const GameContext = Schema.TaggedStruct( "swish/GameContext", {
	turn: PositiveInt,
	players: Schema.Array( PlayerId ),
	currentPlayer: Schema.optional( PlayerId ),
	phase: Schema.optional( Schema.NonEmptyString ),
	teams: Schema.Record( PlayerId, TeamId ),
	teamNames: Schema.Record( TeamId, TeamName ),
	interactions: Schema.Array( InteractionFrame ),
	interactionCount: PositiveInt,
	suspended: Schema.optional( SuspendedTurn )
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
export const Standing = Schema.TaggedStruct( "swish/PlayerStanding", {
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
export const TeamStanding = Schema.TaggedStruct( "swish/TeamStanding", {
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
export const Standings = Schema.TaggedStruct( "swish/Standings", {
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
 * - teams: The sides this game is played in, in order. Absent means no teams.
 * - botDelayMillis: How long a machine-played seat waits before it answers.
 * 		Absent means a bot never plays itself, so a table of bots will sit still.
 * - moveTimeoutMillis: How long a human seat may hold its turn before it is
 * 		handed to `botMove` for the rest of the game. Absent means no clock, which
 * 		is the right answer for a game whose policy cannot always produce a move.
 */
export type BaseGameConfig = typeof BaseGameConfig.Type;
export const BaseGameConfig = Schema.Struct( {
	playerCount: PositiveInt,
	autoStart: Schema.Boolean,
	teams: Schema.optional( Schema.Array( TeamId ) ),
	botDelayMillis: Schema.optional( PositiveInt ),
	moveTimeoutMillis: Schema.optional( PositiveInt )
} );

/**
 * The metadata every form of a game carries, whatever the audience.
 * - id: Id of the game
 * - version: Number denoting the number of commits that happened to the game data
 * - players: Roster of the players in the game
 * - status: Status of the game
 * - context: The context of a game.
 * - results: Optional results filled when game is completed
 */
export type GameHeader = typeof GameHeader.Type;
export const GameHeader = Schema.Struct( {
	id: GameId,
	version: PositiveInt,
	players: Roster,
	status: GameStatus,
	context: GameContext,
	results: Schema.optional( Standings )
} );

/**
 * All game events must be tagged structs and extend this.
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
		Schema.TaggedStruct( "swish/GameData", { state, config, context: GameContext } );

export type GameData<State, Config extends BaseGameConfig> = {
	readonly state: State;
	readonly config: Config;
	readonly context: GameContext;
};


// --- Rematch Structs -------------------------------------------------------------

/**
 * The minimum information required to create a rematch
 * - players: The roster of the finished game
 * - context: The context of the finished game
 * - config: The config of the finished game
 */
export type RematchSource = typeof RematchSource.Type;
export const RematchSource = Schema.TaggedStruct( "swish/RematchSource", {
	players: Roster,
	context: GameContext,
	config: BaseGameConfig
} );

/**
 * The team configuration for the rematch. Created based on user's
 * choice to keep teams or shuffle.
 * - team: TeamId
 * - name: Name of the team
 * - members: Players part of this team
 */
export type RematchTeamConfig = typeof RematchTeamConfig.Type;
export const RematchTeamConfig = Schema.TaggedStruct( "swish/RematchTeamConfig", {
	team: TeamId,
	name: TeamName,
	members: Schema.Array( PlayerId )
} );

/**
 * What the next game is made of: who sits at it, in what order, on which side,
 * and what those sides call themselves.
 * - players: List of Player information in joining order
 * - teams: Team information in the order in of creation
 */
export type RematchPlan = typeof RematchPlan.Type;
export const RematchPlan = Schema.TaggedStruct( "swish/RematchPlan", {
	players: Schema.Array( PlayerInfo ),
	teams: Schema.Array( RematchTeamConfig )
} );


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


// --- Game Identifiers ------------------------------------------------------

/**
 * Where one game lives, as far as a host is concerned.
 * which game it is, and which table.
 * - game: Name of the game
 * - id: Id of the game
 */
export type GameAddress = typeof GameAddress.Type;
export const GameAddress = Schema.TaggedStruct( "swish/GameAddress", {
	game: Schema.NonEmptyString,
	id: GameId
} );

/**
 * Points at a game. Returned by both create and join, which answer the same
 * question — which game.
 * - gameId: Id of the game
 */
export type GameRef = typeof GameRef.Type;
export const GameRef = Schema.Struct( { gameId: GameId } );


// --- Game Forms ------------------------------------------------------------

/**
 * Builds the schema of the authoritative record — the form the engine stores
 * and folds events into. Holds the unredacted `state` and
 * never leaves the engine.
 *
 * @param state - The game's state schema.
 * @param config - The game's config schema.
 * @returns The `swish/GameRecord` schema for this game.
 */
export const GameRecord =
	<State extends Schema.Top, Config extends Schema.Top>( state: State, config: Config ) =>
		Schema.TaggedStruct( "swish/GameRecord", { ...GameHeader.fields, config, state } );

export type GameRecord<State, Config extends BaseGameConfig> = GameHeader & {
	readonly _tag: "swish/GameRecord";
	readonly state: State;
	readonly config: Config;
};

/**
 * Builds the schema handed to a client: the game as one audience sees it.
 * The record with `state` replaced by the view built for that
 * audience. This is the only game shape that crosses the wire.
 *
 * `runtime` rides along whole. It holds nothing private — which seats the bot
 * policy is playing, when the pending one's clock runs out — and a client needs
 * all of it: the turn timer counts down to `deadline`, the seat controls read
 * `autoPlay` to know whether to offer the seat back, and `revision` is what a
 * subscription dedupes on, since a seat handed over commits nothing and so
 * leaves `version` where it was.
 *
 * @param view - The game's view schema.
 * @param config - The game's config schema.
 * @returns The `swish/GameView` schema for this game.
 */
export const GameView =
	<View extends Schema.Top, Config extends Schema.Top>( view: View, config: Config ) =>
		Schema.TaggedStruct( "swish/GameView", {
			...GameHeader.fields,
			config,
			view,
			runtime: GameRuntime
		} );

export type GameView<View, Config extends BaseGameConfig> = GameHeader & {
	readonly _tag: "swish/GameView";
	readonly view: View;
	readonly config: Config;
	readonly runtime: GameRuntime;
};


// --- Hints -----------------------------------------------------------------

/**
 * One suggested move: which move, and what to send with it.
 *
 * Spelled to mirror what `botMove` and `botRespond` return
 * (`server/structure.ts`) because it is the very same value — a hint is the
 * game's own policy asked about the seat that is asking, rather than about a
 * seat the engine is playing. Keeping the two shapes identical is what lets the
 * engine hand a policy's answer straight to the wire with nothing in between to
 * get wrong.
 */
export type HintMove<MoveInputs> = {
	readonly [K in keyof MoveInputs]: {
		readonly moveType: K;
		readonly input: MoveInputs[ K ];
	}
}[ keyof MoveInputs ];

/**
 * What a hint answers with.
 *
 * `move` is optional because a policy may decline — `botMove` returns
 * `undefined` to skip, `botRespond` to pass — and that is a real answer about
 * the position rather than a failure. It is a different thing from
 * `HintUnavailable`, which says the game has no policy to ask at all, and a
 * client has something different to say for each.
 *
 * `frameId` is present only when the hint is about an open interaction window.
 * It names the window the suggestion was computed against, which is both what a
 * client would send back with the move and how it can tell a hint about a
 * question from a hint about a turn.
 */
export type Hint<MoveInputs> = {
	readonly _tag: "swish/Hint";
	readonly move?: HintMove<MoveInputs>;
	readonly frameId?: string;
};

/**
 * Builds the hint schema for one game, from the same move-input schemas the
 * structure declares in `schemas.moves`.
 *
 * The cast is deliberate and is the only one here. `Object.entries` is what
 * turns a record of moves into union members at runtime, and it widens every
 * key to `string` on the way — so the value this builds is right but the type
 * TypeScript infers for it is not. The annotation puts the move names back,
 * exactly as `GameData` above pairs a runtime builder with a written-out type.
 * Keep the cast in this one function: everything downstream reads
 * `Hint<MoveInputs>` and is checked normally.
 *
 * @param moves - The game's move name → input schema map.
 * @returns The `swish/Hint` schema for this game.
 */
/**
 * The hint type for a game, read off the same move name → input schema map its
 * structure and its contract are built from. Saves every game writing the same
 * mapped type to get from schemas to the values that cross the wire.
 */
export type HintOf<Moves extends Schema.Struct.Fields> =
	Hint<{ [K in keyof Moves]: Moves[ K ][ "Type" ] }>;

export const Hint = <Moves extends Schema.Struct.Fields>( moves: Moves ) =>
	Schema.TaggedStruct( "swish/Hint", {
		move: Schema.optional( Schema.Union(
			Object.entries( moves ).map( ( [ moveType, input ] ) =>
				Schema.Struct( { moveType: Schema.Literal( moveType ), input } ) )
		) ),
		frameId: Schema.optional( Schema.NonEmptyString )
	} ) as unknown as Schema.Codec<
		// Spelled out rather than as `HintOf<Moves>`. The alias is invariant in
		// `Moves`, so two of them would only be comparable when the schema maps
		// themselves matched — and the engine holds its moves as `Schema.Codec`s
		// where a contract holds `Schema.Struct`s. Written out, what gets compared
		// is the decoded shape, which is the thing that actually has to agree.
		Hint<{ [K in keyof Moves]: Moves[ K ][ "Type" ] }>,
		unknown
	>;


/**
 * Builds the schema of a game's genesis — everything about a table that is fixed
 * the moment it is created and is never folded from an event. The commit log is
 * the truth about what happened; this is the truth about what it happened *to*.
 *
 * @param state - The game's state schema.
 * @param config - The game's config schema.
 * @returns The `swish/Genesis` schema for this game.
 */
export const Genesis =
	<State extends Schema.Top, Config extends Schema.Top>( state: State, config: Config ) =>
		Schema.TaggedStruct( "swish/GameGenesis", {
			id: GameId,
			createdAt: Schema.Number,
			config,
			initialState: state
		} );

export type Genesis<State, Config extends BaseGameConfig> = {
	readonly _tag: "swish/GameGenesis";
	readonly id: GameId;
	readonly createdAt: number;
	readonly config: Config;
	readonly initialState: State;
};

/**
 * The durable state a game carries that is deliberately *not* event sourced.
 * - autoPlay: The seats currently played by the game's `botMove`
 * - rematch: The game this one's players moved on to, once somebody asked
 * - turnStartedAt: When the pending seat's turn began, as an absolute instant
 * - deadline: When the pending seat's clock runs out, as an absolute instant
 * - interactionStartedAt: When the open window was opened, as an absolute instant
 * - interactionDeadline: When the open window closes, as an absolute instant
 * - raceStartedAt: When the machine-played seats racing out of turn last moved
 * - revision: Counter of every write to this game, committed or not
 *
 * The window's two stamps are kept apart from the turn's because they measure
 * different things. `turnStartedAt` re-stamps every time the set of players being
 * waited on changes, which is what paces a bot: each answer restarts the delay
 * before the next machine-played seat replies. `interactionStartedAt` re-stamps
 * only when a *different* window becomes the open one, so a window's deadline is
 * fixed from the moment it opened and cannot be pushed back by responders taking
 * their time. `interactionDeadline` is what a client counts down to, and is not
 * the same as `deadline`: the latter is whenever the engine next has to wake up,
 * which while bots are answering is a short delay rather than the window itself.
 *
 * `turnStartedAt` is what both clocks are measured from — how long a bot waits
 * before it answers, and how long a player has before their seat is handed over
 * — and `deadline` is whichever of the two applies to the seat about to act.
 * Neither is folded from an event, because a game whose replay consulted the
 * clock would not replay to the same position twice.
 *
 * `raceStartedAt` is a third clock, for a game where seats may move out of turn
 * (a move overriding `canMove`). There the cursor only says whose timeout is
 * running, and pacing every bot through it would make a table of them take
 * their moves in single file. So every machine-played seat that may move gets
 * one shared delay, measured from here and re-stamped each time they have all
 * moved; it is not touched by anybody else's move, so a person playing quickly
 * neither hurries the bots nor holds them back. It is absent whenever no such
 * seat exists.
 *
 * Holding the deadline rather than deriving it per read is safe for one reason
 * only: `persist` is the sole path that writes, so there is one place that can
 * recompute it and no way for a write to slip past. `undo` is the case worth
 * naming, since it rewinds the cursor without otherwise touching `runtime` — it
 * goes through `persist` like everything else, and so re-stamps rather than
 * leaving a deadline behind that outlives the move it belonged to.
 *
 * `revision` is what a client dedupes on, and `version` is not, because the two
 * answer different questions. `version` counts mutations to the *game* — undo
 * moves it, `autoPlay` deliberately does not — and is what decides whether a
 * cached position is stale or a turn timer has been overtaken. `revision`
 * counts writes to the *document*, so a seat handed to the bot policy, or a
 * deadline that moved because of it, is news even though nothing was committed.
 *
 * `spectators` is here for exactly that reason. Somebody choosing to watch is
 * news to everyone already watching — the name has to appear on their screens
 * — but it is not something that *happened in the game*: it commits nothing,
 * moves no turn, and a replay that folded it would be folding an audience into
 * a position. Writing it through `persist` bumps `revision` without touching
 * `version`, which is precisely the distinction above, and the open streams
 * pick it up with no resubscribe.
 *
 * It holds whole `PlayerInfo`s rather than ids because it is rendered: a bare
 * id would leave the client with a name it has no way to look up, since a
 * spectator is by definition absent from `players`. The decoding default is
 * what lets a game written before this field existed still load — the key is
 * simply absent in Redis, and an absent audience is an empty one.
 */
export type GameRuntime = typeof GameRuntime.Type;
export const GameRuntime = Schema.TaggedStruct( "swish/GameRuntime", {
	autoPlay: Schema.HashSet( PlayerId ),
	spectators: Roster.pipe( Schema.withDecodingDefaultKey( Effect.succeed( {} ) ) ),
	rematch: Schema.optional( GameRef ),
	turnStartedAt: Schema.optional( Schema.Number ),
	deadline: Schema.optional( Schema.Number ),
	interactionStartedAt: Schema.optional( Schema.Number ),
	interactionDeadline: Schema.optional( Schema.Number ),
	raceStartedAt: Schema.optional( Schema.Number ),
	revision: PositiveInt
} );

/**
 * Builds the schema of everything a live game holds.
 * - genesis: The Genesis for this game
 * - log: The truth of what has happened in this game
 * - cursor: Number denoting how far the log has been read
 * 		Everything in the log after this is redo tail
 * - version: Number denoting the number of mutations
 * 		that have happened in this game.
 * - runtime: Runtime state of this game not event sourced
 *
 * @param state - The game's state schema.
 * @param config - The game's config schema.
 * @param events - The game's event schema.
 * @returns The `swish/GameDocument` schema for this game.
 */
export const GameDocument =
	<State extends Schema.Top, Config extends Schema.Top, Ev extends Schema.Top>
	( state: State, config: Config, events: Ev ) =>
		Schema.TaggedStruct( "swish/GameDocument", {
			genesis: Genesis( state, config ),
			log: Schema.Array( Commit( events ) ),
			cursor: PositiveInt,
			version: PositiveInt,
			runtime: GameRuntime
		} );

export type GameDocument<State, Config extends BaseGameConfig, Events> = {
	readonly _tag: "swish/GameDocument";
	readonly genesis: Genesis<State, Config>;
	readonly log: ReadonlyArray<Commit<Events>>;
	readonly cursor: number;
	readonly version: number;
	readonly runtime: GameRuntime;
};

export type LiveGameResident<State, Config extends BaseGameConfig, Events> = {
	readonly document: GameDocument<State, Config, Events>;
	readonly record: GameRecord<State, Config>;
};


// --- Engine events ---------------------------------------------------------

/**
 * Emitted when a player joins a game.
 * Adds the player to the roster.
 */
export type PlayerJoined = typeof PlayerJoined.Type;
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
 * Emitted to open an interaction window. Pushes a frame onto the stack.
 *
 * The one engine event a *game* emits: a window is opened from inside a move's
 * `execute`, a hook, or another window's `onResolve`, because only the game
 * knows that its action is the kind somebody may object to. The engine folds it
 * all the same — `foldEvents` routes on the `swish/ev/` prefix, not on who
 * produced it — so the split the engine keeps is still "engine events touch the
 * context, game events touch the state".
 *
 * The policy fields are all optional here and required on the frame, because the
 * engine fills them in on the way through: whatever the emitting game left out is
 * taken from the window kind's own declaration, and only then is the event
 * recorded. What reaches the log is therefore always explicit, and a later change
 * to a kind's defaults cannot reach back and reinterpret a game already played.
 *
 * `id`, `pending`, `responses` and `openedAtTurn` are not here at all: they are
 * derived when the event is folded, which is what keeps a frame id stable under
 * replay without any of the emitting code having to invent one.
 */
export type InteractionOpened = typeof InteractionOpened.Type;
export const InteractionOpened = Schema.TaggedStruct( "swish/ev/InteractionOpened", {
	kind: Schema.NonEmptyString,
	initiator: PlayerId,
	subject: Schema.optional( PlayerId ),
	responders: Schema.Array( PlayerId ),
	options: Schema.optional( Schema.Array( InteractionOption ) ),
	resolution: Schema.optional( InteractionResolution ),
	allowPass: Schema.optional( Schema.Boolean ),
	secret: Schema.optional( Schema.Boolean ),
	timeoutMillis: Schema.optional( PositiveInt )
} );

/**
 * Emitted when a responder answers a window with one of its moves. Records the
 * response and takes them off `pending` — and on a `first` window, takes
 * everybody else off too, since the race is over.
 */
export type InteractionResponded = typeof InteractionResponded.Type;
export const InteractionResponded = Schema.TaggedStruct( "swish/ev/InteractionResponded", {
	frameId: Schema.NonEmptyString,
	playerId: PlayerId,
	move: Schema.NonEmptyString
} );

/**
 * Emitted when a responder declines a window. Takes them off `pending` without
 * closing it for anyone else — a pass is one seat's answer, never the table's.
 */
export type InteractionPassed = typeof InteractionPassed.Type;
export const InteractionPassed = Schema.TaggedStruct( "swish/ev/InteractionPassed", {
	frameId: Schema.NonEmptyString,
	playerId: PlayerId
} );

/**
 * Emitted when a window's clock runs out on a responder who never answered.
 *
 * Folded exactly like a pass, and kept distinct from one because the game may
 * need to tell them apart: on an optional window silence is consent, but on a
 * mandatory one it is a decision nobody made, and `onResolve` is the only thing
 * that can say what to do about it.
 */
export type InteractionExpired = typeof InteractionExpired.Type;
export const InteractionExpired = Schema.TaggedStruct( "swish/ev/InteractionExpired", {
	frameId: Schema.NonEmptyString,
	playerId: PlayerId
} );

/**
 * Emitted when a window is settled and comes off the stack.
 *
 * Addressed by id rather than popping the top, because the engine closes a frame
 * *before* handing it to `onResolve` — which is free to open the next window
 * immediately, and would otherwise be pushing onto a stack whose top is about to
 * be thrown away.
 */
export type InteractionClosed = typeof InteractionClosed.Type;
export const InteractionClosed = Schema.TaggedStruct( "swish/ev/InteractionClosed", {
	frameId: Schema.NonEmptyString
} );

/**
 * Emitted when a turn-ending move opens a window instead of ending the turn.
 * Records whose tail is waiting, so the engine can run the right one later.
 */
export type TurnSuspended = typeof TurnSuspended.Type;
export const TurnSuspended = Schema.TaggedStruct( "swish/ev/TurnSuspended", {
	actor: PlayerId,
	moveType: Schema.NonEmptyString
} );

/**
 * Emitted when the last window closes and the suspended turn tail is about to
 * run. Clears the suspension.
 */
export type TurnResumed = typeof TurnResumed.Type;
export const TurnResumed = Schema.TaggedStruct( "swish/ev/TurnResumed", {} );

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
	InteractionPassed,
	InteractionExpired,
	InteractionClosed,
	TurnSuspended,
	TurnResumed
] );

/**
 * The engine events a game is allowed to emit for itself.
 *
 * Only one: opening a window. Everything else in `EngineEvent` is the engine's
 * own bookkeeping — who is seated, whose turn it is, which phase is running —
 * and a game reaching for those would be writing the header behind the engine's
 * back. Opening a window is different in kind: the decision to ask the table
 * something is the game's, and the engine is only the thing that then runs the
 * asking.
 */
export type GameEmittedEngineEvent = typeof GameEmittedEngineEvent.Type;
export const GameEmittedEngineEvent = InteractionOpened;

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
 * - actor: The player whose action resulted in this commit
 * - moveType: The type of move that made this commit
 */
export type CommitMeta = typeof CommitMeta.Type;
export const CommitMeta = Schema.TaggedStruct( "swish/CommitMeta", {
	command: Schema.NonEmptyString,
	actor: PlayerId,
	moveType: Schema.optional( Schema.NonEmptyString )
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
export const Commit = <Ev extends Schema.Top>( ev: Ev ) =>
	Schema.Struct( {
		id: CommitId,
		at: Schema.Number,
		events: Schema.Array( GameEvent( ev ) ),
		meta: CommitMeta
	} );


export type Commit<Events> = {
	readonly id: CommitId;
	readonly at: number;
	readonly events: ReadonlyArray<EngineEvent | Events>;
	readonly meta: CommitMeta;
};

/**
 * One command's finished work: the commit to append, and the record it leaves
 * behind. Produced by `seal`, and the only thing a caller has to persist.
 */
export type SealedCommit<State, Config extends BaseGameConfig, Events extends BaseGameEvent> = {
	readonly commit: Commit<Events>;
	readonly record: GameRecord<State, Config>;
};


// --- API Inputs & Responses ---------------------------------------------

/**
 * Builds the InitializeInput given the config schema.
 * - id: Id of the game
 * - config: The config of that game. Optional: `initialize` merges whatever is
 * 		given over the game's `defaultConfig`, so a caller with nothing to change
 * 		sends nothing rather than restating every default
 * - isPrivate: Whether this table is kept off the lobby
 *
 * `isPrivate` rides here rather than on the config, and the distinction is the
 * point: a config is the rules the engine plays by, and this changes none of
 * them. No `setup` reads it, no move is gated on it, `view()` never carries it
 * and replay never sees it — it decides one thing, whether strangers are
 * offered this table, and it is answered once at creation and written straight
 * to the row the lobby queries. Putting it in the config would hand every game
 * a setting none of them can use and put it in every view of every game.
 *
 * Required rather than optional, because the choice is made in the one panel
 * every game creates from: a caller that reaches the command directly has to
 * say which it meant instead of inheriting whichever default was written here.
 *
 * @param config - The game's config schema.
 * @returns The `swish/InitializeInput` schema for this game.
 */
export const InitializeInput = <Config extends Schema.Top>( config: Config ) =>
	Schema.TaggedStruct(
		"swish/InitializeInput",
		{ id: GameId, config, isPrivate: Schema.Boolean }
	);

export type InitializeInput<Config extends BaseGameConfig> = {
	id: GameId;
	config: Config;
	isPrivate: boolean;
};

/**
 * The input required to take a side, or move to another one. The seat being
 * assigned is the caller's own, extracted from the authentication information.
 * - team: The side to take
 */
export type JoinTeamInput = typeof JoinTeamInput.Type;
export const JoinTeamInput = Schema.TaggedStruct( "swish/JoinTeamInput", { team: TeamId } );

/**
 * The input required to name a side. The caller must already be on it, and it
 * must not be named yet — a name is chosen once and never changed.
 * - team: The side being named
 * - name: What it calls itself
 */
export type NameTeamInput = typeof NameTeamInput.Type;
export const NameTeamInput = Schema.TaggedStruct(
	"swish/NameTeamInput",
	{ team: TeamId, name: TeamName }
);

/**
 * The input required to hand a seat to the bot policy, or to take it back. The
 * seat being switched is the caller's own, extracted from the authentication
 * information.
 * - enabled: `true` to let the game's `botMove` play this seat
 */
export type AutoPlayInput = typeof AutoPlayInput.Type;
export const AutoPlayInput = Schema.TaggedStruct(
	"swish/AutoPlayInput",
	{ enabled: Schema.Boolean }
);

/**
 * The input required to decline an open interaction window. The seat declining
 * is the caller's own, extracted from the authentication information.
 * - frameId: The window being declined. Optional, and checked when given: a
 * 		client that saw one window and clicked as it was replaced by the next is
 * 		refused rather than quietly answering a question it never read
 */
export type PassInteractionInput = typeof PassInteractionInput.Type;
export const PassInteractionInput = Schema.TaggedStruct( "swish/PassInteractionInput", {
	frameId: Schema.optional( Schema.NonEmptyString )
} );

/**
 * The query string a response endpoint accepts.
 * - frame: The window this move is answering. Checked the same way
 * 		`PassInteractionInput.frameId` is, and optional for the same reason: a
 * 		caller that cannot tell which window is open is answering whichever one is
 */
export type RespondQuery = typeof RespondQuery.Type;
export const RespondQuery = Schema.Struct( {
	frame: Schema.optional( Schema.NonEmptyString )
} );

/**
 * The input required to start a rematch: another game of the same kind, with
 * the same config and the same people around it.
 * - keepTeams: `true` to seat everyone back on the side they just played
 */
export type RematchInput = typeof RematchInput.Type;
export const RematchInput = Schema.TaggedStruct(
	"swish/RematchInput",
	{ keepTeams: Schema.Boolean }
);

export type GameChanged = typeof GameChanged.Type;
export const GameChanged = Schema.TaggedStruct( "swish/GameChanged", {
	game: Schema.NonEmptyString,
	gameId: GameId,
	version: PositiveInt
} );
