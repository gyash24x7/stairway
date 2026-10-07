import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as Stream from "effect/Stream";

import type {
	AlreadyProcessingMessage,
	EntityNotAssignedToRunner,
	MailboxFull,
	PersistenceError
} from "effect/cluster/ClusterError";

import { AuthContext } from "@/auth/contract";
import {
	AlreadyJoined,
	CannotStart,
	GameFull,
	GameNotInProgress,
	GameNotJoinable,
	InteractionInProgress,
	InteractionNotOpen,
	InteractionStale,
	InvalidTeamConfig,
	NotAMember,
	NotRespondingTo,
	TeamsUnavailable
} from "@/swish/errors";
import type {
	Audience,
	BaseGameConfig,
	BaseGameEvent,
	Commit,
	GameContext,
	GameRecord,
	GameRuntime,
	InteractionFrame,
	RematchSource,
	SwishUser,
	TeamId
} from "@/swish/schema";
import {
	PlayerId,
	PlayerInfo,
	RematchPlan,
	RematchTeamConfig,
	Standings,
	TeamName,
	TeamStanding
} from "@/swish/schema";
import { foldEvents } from "@/swish/server/events";

export const withAuth = <A, E, R>(
	effect: ( user: SwishUser ) => Effect.Effect<A, E, R>
) => AuthContext.pipe( Effect.flatMap( effect ) );


export const playerIdFor = ( audience: Audience ) =>
	Match.value( audience ).pipe(
		Match.tag( "swish/PlayerAudience", audience => audience.playerId ),
		Match.tag( "swish/TableAudience", () => undefined ),
		Match.exhaustive
	);

export const toPlayerInfo = ( user: SwishUser ) =>
	PlayerInfo.make( {
		id: PlayerId.make( user.id ),
		name: user.name,
		avatar: user.avatar
	} );

type ClusterError =
	| AlreadyProcessingMessage
	| EntityNotAssignedToRunner
	| MailboxFull
	| PersistenceError;

const clusterErrorTags = new Set( [
	"AlreadyProcessingMessage",
	"EntityNotAssignedToRunner",
	"MailboxFull",
	"PersistenceError"
] );

const isClusterError = ( e: unknown ): e is ClusterError =>
	typeof e === "object" && e !== null && "_tag" in e && clusterErrorTags.has( e._tag as string );

export const dieOnClusterError = <A, E, R>( effect: Effect.Effect<A, ClusterError | E, R> ) =>
	Effect.catchIf( effect, isClusterError, Effect.die );

/**
 * The streaming twin of {@link dieOnClusterError}, for a command whose client
 * call hands back a `Stream` rather than an `Effect`.
 *
 * A cluster error is never the caller's business — it says the message could
 * not be delivered, not that the game refused it — so it is a defect here for
 * the same reason it is there. It matters more on a stream: a subscription
 * outlives the request that opened it, so a runner going away mid-stream would
 * otherwise surface to the client as a typed game error it has no way to act on.
 *
 * @param stream - The entity client's stream.
 * @returns The same stream with cluster failures turned into defects.
 */
export const dieOnClusterErrorStream = <A, E, R>(
	stream: Stream.Stream<A, ClusterError | E, R>
) => Stream.catchIf( stream, isClusterError, Stream.die );

/**
 * Rebuilds a record by folding the log onto genesis.
 *
 * This is the only way a record is ever produced from storage, and it is also
 * how undo works: there are no inverse events — an immer reducer cannot be run
 * backwards — so stepping the cursor back and re-folding from the opening
 * position *is* the undo. The cost is a full re-fold per undo, which is what
 * keeps the reducers cheap and pure.
 *
 * `cursor` is where the log is being read to, not how long it is. Anything past
 * it is the redo tail: still stored, not yet part of the game. `version` is
 * carried in rather than derived from either, because it counts every mutation
 * including the undos — a client that cached `v7` has to see a number above it
 * after a take-back, or it will discard the new record as stale.
 *
 * @param genesisRecord - The table's creation facts.
 * @param options - The log, how far to read it, the version to stamp, and the game's reducer.
 * @returns The record as of `cursor`.
 */
export const replay = <State, Config extends BaseGameConfig, Events extends BaseGameEvent>(
	genesisRecord: GameRecord<State, Config>,
	options: {
		readonly log: ReadonlyArray<Commit<Events>>;
		readonly cursor: number;
		readonly version: number;
		readonly apply: ( state: State, event: Events ) => State;
	}
) => {
	const upto = Math.max( 0, Math.min( options.cursor, options.log.length ) );

	let record = genesisRecord;
	for ( let index = 0; index < upto; index++ ) {
		record = foldEvents( record, options.log[ index ]?.events ?? [], options.apply );
	}

	return { ...record, version: options.version };
};

/**
 * The default turn order: the next seat round the table, wrapping at the end.
 * A player who is not seated hands the turn to the first seat, which is what a
 * table with nobody on it degrades to as well.
 *
 * @param context - The context to read the seating order from.
 * @param playerId - The seat that just acted.
 * @returns The seat that acts next.
 */
export const nextInOrder = ( context: GameContext, playerId: PlayerId ) => {
	const order = context.players;
	if ( order.length === 0 ) {
		return playerId;
	}

	return order[ ( order.indexOf( playerId ) + 1 ) % order.length ]!;
};


// --- Turn Clock --------------------------------------------------------------

/**
 * Whether the seat waiting to act has changed between two records.
 *
 * What `persist` re-stamps `turnStartedAt` on, and deliberately not "did
 * anything change at all": `autoPlay` writes the document without moving the
 * turn, and a stamp that followed it would let a player hold their seat forever
 * by flicking the switch off and on. It would also quietly extend the clock
 * across a turn made of several `endsTurn: false` actions, which is the one
 * thing `moveTimeoutMillis` promises it will not do.
 *
 * `phase` needs no part in this. `PhaseEntered` is only reachable through the
 * turn tail, which advances the turn first, so `turn` has always moved by then.
 *
 * @param previous - The record as it stood before the write, if there was one.
 * @param next - The record being written.
 * @returns `true` when the clock should start over.
 */
export const pendingSeatChanged = <State, Config extends BaseGameConfig>(
	previous: GameRecord<State, Config> | undefined,
	next: GameRecord<State, Config>
) => previous === undefined
	|| previous.status !== next.status
	|| previous.context.turn !== next.context.turn
	|| previous.context.currentPlayer !== next.context.currentPlayer;

/**
 * Whether a *different* interaction window is the open one.
 *
 * What `interactionStartedAt` is re-stamped on, and the reason a window's clock
 * is not the turn's. A window's deadline has to be fixed from the moment it
 * opened: measured from the last thing that happened instead, a table could hold
 * a challenge window open indefinitely by answering it slowly, one responder at a
 * time. Comparing ids rather than depth is what makes a window that closes and is
 * immediately replaced by another count as a new one.
 *
 * @param previous - The record as it stood before the write, if there was one.
 * @param next - The record being written.
 * @returns `true` when the window clock should start over.
 */
export const activeFrameChanged = <State, Config extends BaseGameConfig>(
	previous: GameRecord<State, Config> | undefined,
	next: GameRecord<State, Config>
) => activeFrame( next.context )?.id !== (
	previous === undefined ? undefined : activeFrame( previous.context )?.id
);

/**
 * Whether the set of players the game is waiting on has changed.
 *
 * The seat whose turn it is, *or* — while a window is open — the responders who
 * have yet to answer it. This is what `turnStartedAt` is re-stamped on, and
 * extending it to the window is what paces a table of bots through one: each
 * answer restarts the delay, so machine-played responders reply a beat apart
 * rather than all in the same instant.
 *
 * @param previous - The record as it stood before the write, if there was one.
 * @param next - The record being written.
 * @returns `true` when the clock should start over.
 */
export const pendingActorsChanged = <State, Config extends BaseGameConfig>(
	previous: GameRecord<State, Config> | undefined,
	next: GameRecord<State, Config>
) => {
	if ( pendingSeatChanged( previous, next ) || activeFrameChanged( previous, next ) ) {
		return true;
	}

	const frame = activeFrame( next.context );
	if ( !frame ) {
		return false;
	}

	// Same window, so the previous record has the same frame under the same id.
	const before = activeFrame( previous!.context )!;
	return before.pending.length !== frame.pending.length;
};

/**
 * Whether a seat is played by the game's `botMove` rather than by a person —
 * either because nobody ever sat there, or because whoever did handed it over.
 *
 * @param record - The record holding the roster.
 * @param runtime - The runtime holding the handed-over seats.
 * @param playerId - The seat being asked about.
 * @returns `true` when the bot policy answers for this seat.
 */
export const isMachinePlayed = <State, Config extends BaseGameConfig>(
	record: GameRecord<State, Config>,
	runtime: GameRuntime,
	playerId: PlayerId
) => record.players[ playerId ]?.isBot === true || HashSet.has( runtime.autoPlay, playerId );

/**
 * The clocks a table is running, as absolute instants.
 *
 * Two answers rather than one, because they are read by different things.
 * `deadline` is when the engine next has to wake up, and is the earlier of
 * whatever applies; `interactionDeadline` is when the open window actually
 * closes, and is what a client counts down. They differ while bots are answering
 * a window: the engine wakes every `botDelayMillis` to take one more answer, but
 * showing a responder a clock that resets each time somebody else replies would
 * be a lie about how long they have.
 *
 * With a window open, the seat whose turn it is has no clock at all: their turn
 * is suspended, they are not who the table is waiting on, and handing their seat
 * to the bot policy for failing to move during somebody else's decision would be
 * a punishment for being interrupted.
 *
 * With no window open, which clock applies is decided by who is about to act, not
 * by who they are: a seat played by a machine waits out `botDelayMillis` before
 * it answers, and a seat played by a person holds it for `moveTimeoutMillis`
 * before it is handed over. Both need `botDelayMillis`, including the human one —
 * a timeout's only outcome is to hand the seat to the very policy that clock
 * governs, so without it a timeout would take the seat away and leave nothing to
 * play it, which is worse than keeping no clock at all.
 *
 * @param record - The current record.
 * @param runtime - The runtime holding the stamps and the handed-over seats.
 * @param policies - Which bot policies the game declares.
 * @returns The instants the engine and the open window run out, either may be absent.
 */
export const resolveClock = <State, Config extends BaseGameConfig>(
	record: GameRecord<State, Config>,
	runtime: GameRuntime,
	policies: { readonly botMove: boolean; readonly botRespond: boolean }
) => {
	const { botDelayMillis, moveTimeoutMillis } = record.config;
	const { turnStartedAt, interactionStartedAt } = runtime;
	const none = { deadline: undefined, interactionDeadline: undefined };

	if ( record.status !== "IN_PROGRESS" || turnStartedAt === undefined ) {
		return none;
	}

	const frame = activeFrame( record.context );

	if ( frame ) {
		const interactionDeadline =
			frame.timeoutMillis === undefined || interactionStartedAt === undefined
				? undefined
				: interactionStartedAt + frame.timeoutMillis;

		// A machine-played responder answers on the bot delay, which is almost always
		// sooner than the window's own deadline — so it is the wake-up that matters,
		// while the window's stays the one the table is counting down.
		const answering = policies.botRespond
			&& botDelayMillis !== undefined
			&& frame.pending.some( playerId => isMachinePlayed( record, runtime, playerId ) );

		const botDeadline = answering ? turnStartedAt + botDelayMillis : undefined;
		const candidates = [ interactionDeadline, botDeadline ].filter( at => at !== undefined );

		return {
			deadline: candidates.length === 0 ? undefined : Math.min( ...candidates ),
			interactionDeadline
		};
	}

	const currentPlayer = record.context.currentPlayer;
	if ( !policies.botMove || botDelayMillis === undefined || !currentPlayer ) {
		return none;
	}

	if ( isMachinePlayed( record, runtime, currentPlayer ) ) {
		return { deadline: turnStartedAt + botDelayMillis, interactionDeadline: undefined };
	}

	return {
		deadline: moveTimeoutMillis === undefined ? undefined : turnStartedAt + moveTimeoutMillis,
		interactionDeadline: undefined
	};
};


// --- Team Utils ----------------------------------------------------------------


/**
 * What a side calls itself, if it named itself at all. A side is named at most
 * once, so this never changes once it answers.
 *
 * @param context - The context holding the names.
 * @param team - The side being looked up.
 * @returns Its chosen name, or `undefined` when it never chose one.
 */
export const nameOf = ( context: GameContext, team: TeamId ) => context.teamNames[ team ];

/**
 * How many seats each side holds. Sides are equal-sized, which `initialize`
 * enforces, so this divides evenly for any config that reached storage.
 *
 * @param config - The game config declaring the sides.
 * @returns Seats per side, or `undefined` when the game has no teams.
 */
export const teamSize = ( config: BaseGameConfig ) =>
	config.teams ? config.playerCount / config.teams.length : undefined;

/**
 * The side a player is on.
 * @param context - The context holding membership.
 * @param playerId - The player being looked up.
 * @returns Their team, or `undefined` when they hold none.
 */
export const teamOf = ( context: GameContext, playerId: PlayerId ) => context.teams[ playerId ];

/**
 * Everyone on a side, in seat order.
 * @param context - The context holding membership and the seating order.
 * @param team - The side being listed.
 * @returns That side's players, ordered as they are seated.
 */
export const membersOf = ( context: GameContext, team: TeamId ) =>
	context.players.filter( playerId => teamOf( context, playerId ) === team );

/**
 * Whether two players are on the same side. Two players who both hold no side are
 * not teammates — an unassigned seat has no partners, it has no team at all.
 *
 * @param context - The context holding membership.
 * @param playerId - The first player.
 * @param other - The second player.
 * @returns `true` when both hold the same team.
 */
export const areTeammates = ( context: GameContext, playerId: PlayerId, other: PlayerId ) => {
	const team = teamOf( context, playerId );
	return team !== undefined && team === teamOf( context, other );
};

/**
 * Everyone playing alongside a player, in seat order — the player themselves
 * excluded.
 *
 * Returns nothing in a game without teams: a seat holding no side has no
 * partners, and two seats holding none are not teammates. `areTeammates` draws
 * the same line, and this is its list form.
 *
 * @param context - The context holding membership and the seating order.
 * @param playerId - The player whose teammates are wanted.
 * @returns The other players on that player's side.
 */
export const teamMatesOf = ( context: GameContext, playerId: PlayerId ) => {
	const team = teamOf( context, playerId );
	return team === undefined
		? []
		: context.players.filter(
			other => other !== playerId && teamOf( context, other ) === team
		);
};

/**
 * Everyone playing against a player, in seat order. This is what a move's
 * `execute` builds an interaction frame's `responders` from when a side reacts as
 * a group: the frame itself stays a plain list of players.
 *
 * Returns nothing in a game without teams, where no seat opposes another by side.
 *
 * @param context - The context holding membership and the seating order.
 * @param playerId - The player whose opponents are wanted.
 * @returns The players not on that player's side.
 */
export const opponentsOf = ( context: GameContext, playerId: PlayerId ) => {
	const team = teamOf( context, playerId );
	return team === undefined
		? []
		: context.players.filter(
			other => other !== playerId && teamOf( context, other ) !== team
		);
};


/**
 * Checks a config's teams can actually be seated: at least two sides, no repeats,
 * and a `playerCount` that splits evenly between them. Returns the failure rather
 * than raising it, the way a move's `validate` does.
 *
 * @param config - The config being created with.
 * @returns The reason it cannot be seated, or `undefined` when it can.
 */
export const validateTeamConfig = ( config: BaseGameConfig ) => {
	const teams = config.teams;
	if ( !teams ) {
		return undefined;
	}

	if ( teams.length < 2 ) {
		return new InvalidTeamConfig( {
			reason: `A team game needs at least two sides, got ${ teams.length }.`
		} );
	}

	if ( new Set( teams ).size !== teams.length ) {
		return new InvalidTeamConfig( { reason: "Team ids must be unique." } );
	}

	if ( config.playerCount % teams.length !== 0 ) {
		return new InvalidTeamConfig( {
			reason: `${ config.playerCount } seats do not split evenly between ${ teams.length } sides.`
		} );
	}

	return undefined;
};

/**
 * Hands a side to every seat that did not pick one, filling the emptiest side
 * each time.
 *
 * A table is rarely tidy when it starts: sides are picked in the lobby, but
 * `autoStart` leaves only a moment to pick one and bots never do. Rather than
 * refuse to start, `start` balances what is left — so a game whose players all
 * ignored the lobby still begins with even sides.
 *
 * @param players - The seating order as it stands.
 * @param teams - The sides this game declares, in order.
 * @param assigned - Who is already on which side.
 * @returns The side each unassigned seat should take, in seat order.
 */
export const balanceTeams = (
	players: ReadonlyArray<PlayerId>,
	teams: ReadonlyArray<TeamId>,
	assigned: Readonly<Record<PlayerId, TeamId>>
) => {
	const counts = new Map( teams.map( team => [
		team,
		players.filter( player => assigned[ player ] === team ).length
	] ) );

	return players
		.filter( player => !assigned[ player ] )
		.map( playerId => {
			const team = teams.reduce( ( emptiest, candidate ) =>
				counts.get( candidate )! < counts.get( emptiest )! ? candidate : emptiest );

			counts.set( team, counts.get( team )! + 1 );
			return { playerId, team };
		} );
};

/**
 * Re-seats a team game so the sides alternate round the table.
 *
 * Interleaving is what lets the default turn order do the right thing: seats
 * taken in the order people happened to join would give one side several turns
 * in a row, whereas alternating them means plain round-robin already passes play
 * from side to side.
 *
 * The result is always a permutation of the roster. Anyone still without a side
 * keeps a place at the back rather than being dropped — the seating order is
 * what each player's view is built from, so a seat missing from it would
 * quietly be served the table's view instead of its own.
 *
 * @param players - The seating order as it stands.
 * @param teams - The sides this game declares, in order.
 * @param assigned - Who is on which side.
 * @returns The interleaved seating order.
 */
export const interleaveSeats = (
	players: ReadonlyArray<PlayerId>,
	teams: ReadonlyArray<TeamId>,
	assigned: Readonly<Record<PlayerId, TeamId>>
) => {
	const sides = teams.map( team => players.filter( player => assigned[ player ] === team ) );
	const deepest = Math.max( 0, ...sides.map( side => side.length ) );
	const order: Array<PlayerId> = [];

	for ( let seat = 0; seat < deepest; seat++ ) {
		for ( const side of sides ) {
			if ( seat < side.length ) {
				const playerId = side[ seat ];
				if ( playerId ) {
					order.push( playerId );
				}
			}
		}
	}

	const seated = new Set<PlayerId>( order );
	return [ ...order, ...players.filter( player => !seated.has( player ) ) ];
};


// --- Rematch Utils ----------------------------------------------------------------

/**
 * Who sits at the next game, in what order, and on which side.
 *
 * The roster is carried over whole and in seat order — bots included, because a
 * seat a machine played is still a seat, and leaving it out would hand the
 * rematch a hole nobody asked for. That order is what the new table is seated
 * in, so a game that ended with the sides interleaved starts the next one the
 * same way.
 *
 * `keepTeams` is the one choice the caller gets. Keeping them carries each
 * side's membership *and* its name across; dropping them leaves every seat
 * unassigned, and the new game balances them at `start` exactly as it would for
 * a table whose players never picked. A side that never named itself is carried
 * over under its own id, since a plan has to name something and the id is what
 * the lobby would show anyway.
 *
 * @param source - The finished game's roster, context and config.
 * @param keepTeams - Whether the sides come with them.
 * @returns The plan the next table is built from.
 */
export const rematchPlanFor = ( source: RematchSource, keepTeams: boolean ): RematchPlan => {
	const players = source.context.players
		.map( playerId => source.players[ playerId ] )
		.filter( ( player ): player is PlayerInfo => player !== undefined );

	const sides = source.config.teams;
	if ( !keepTeams || !sides ) {
		return RematchPlan.make( { players, teams: [] } );
	}

	const teams = sides.map( team => RematchTeamConfig.make( {
		team,
		name: TeamName.make( source.context.teamNames[ team ] ?? team ),
		members: membersOf( source.context, team )
	} ) );

	return RematchPlan.make( { players, teams } );
};


// --- Results Utils ----------------------------------------------------------------

/**
 * Stamps each standing with the side its player was on, and works out the
 * per-side ranking the game did not.
 *
 * A game only has to rank the players. Sides are placed by total score where the
 * game scores, and by each side's best-placed player where it does not; sides
 * level on that key share a rank. A game that filled `teamRanking` itself is
 * left alone apart from the side stamps.
 *
 * `winner` is dropped for a team game: it names a single player, which has no
 * meaning when a side wins together, and `winningTeam` is the verdict instead.
 *
 * @param standings - What the game's `resolveResults` returned.
 * @param context - The completed game's context, holding who was on which side.
 * @returns The standings as the engine records them.
 */
export const compileStandings = ( standings: Standings, context: GameContext ) => {
	const assigned = context.teams;
	if ( Object.keys( assigned ).length === 0 ) {
		return standings;
	}

	const ranking = standings.ranking.map( standing => ( {
		...standing,
		team: standing.team ?? assigned[ standing.playerId ]
	} ) );

	if ( standings.teamRanking ) {
		return { ...standings, ranking };
	}

	const scored = ranking.every( standing => standing.score !== undefined );
	const totals = new Map<TeamId, { score: number; best: number }>();

	for ( const standing of ranking ) {
		if ( !standing.team ) {
			continue;
		}

		const total = totals.get( standing.team ) ?? { score: 0, best: Number.MAX_SAFE_INTEGER };
		totals.set( standing.team, {
			score: total.score + ( standing.score ?? 0 ),
			best: Math.min( total.best, standing.rank )
		} );
	}

	const keyOf = ( total: { score: number; best: number } ) => scored ? total.score : total.best;
	const ordered = [ ...totals.entries() ]
		.sort( ( [ , a ], [ , b ] ) => scored ? b.score - a.score : a.best - b.best );

	const teamRanking = ordered.map( ( [ team, total ] ) => TeamStanding.make( {
		team,
		rank: ordered.findIndex( ( [ , other ] ) => keyOf( other ) === keyOf( total ) ) + 1,
		score: scored ? total.score : undefined
	} ) );

	return Standings.make( {
		ranking,
		teamRanking,
		winningTeam: standings.winningTeam ?? ordered[ 0 ]?.[ 0 ]
	} );
};


// --- Reading a window ------------------------------------------------------

/**
 * The window being answered right now, if any.
 *
 * The *last* frame on the stack, not the first: a window opened while another is
 * still open is a question about that question — a challenge to a block — and has
 * to be settled before the one underneath it can be. Everything in the engine
 * that gates on an open window gates on this one.
 *
 * @param context - The context holding the stack.
 * @returns The innermost open window, or `undefined` when none is open.
 */
export const activeFrame = ( context: GameContext ) =>
	context.interactions[ context.interactions.length - 1 ];

/**
 * A specific window by id, wherever it sits on the stack.
 *
 * @param context - The context holding the stack.
 * @param frameId - The window being looked up.
 * @returns That window, or `undefined` when it is not open.
 */
export const frameById = ( context: GameContext, frameId: string ) =>
	context.interactions.find( frame => frame.id === frameId );

/**
 * Whether a window has heard everything it is going to.
 *
 * One rule for both resolutions, because `pending` already carries the
 * difference: a `first` window empties it the moment somebody answers, an `all`
 * window empties it one responder at a time.
 *
 * @param frame - The window being asked about.
 * @returns `true` when the window is ready to close.
 */
export const isSettled = ( frame: InteractionFrame ) => frame.pending.length === 0;

/**
 * The moves one player may answer a window with.
 *
 * An option with no `players` is open to every responder; one that names them is
 * open to those alone. A player who is not being waited on has no options at all,
 * however the window is set up — answering twice is not one of the things a
 * window allows.
 *
 * @param frame - The open window.
 * @param playerId - The player asking what they can do.
 * @returns The move names that player may play, in the order the window lists them.
 */
export const optionsFor = ( frame: InteractionFrame, playerId: PlayerId ) =>
	frame.pending.includes( playerId )
		? frame.options
			.filter( option => !option.players || option.players.includes( playerId ) )
			.map( option => option.move )
		: [];

/**
 * Whether a player may answer a window with a particular move.
 *
 * @param frame - The open window.
 * @param playerId - The player attempting to answer.
 * @param move - The move they are attempting.
 * @returns `true` when the window accepts that move from that player.
 */
export const canRespond = ( frame: InteractionFrame, playerId: PlayerId, move: string ) =>
	optionsFor( frame, playerId ).includes( move );

/**
 * What one player said to a window, if they have said anything.
 *
 * @param frame - The window being read.
 * @param playerId - The responder being looked up.
 * @returns Their response, or `undefined` while they are still being waited on.
 */
export const responseOf = ( frame: InteractionFrame, playerId: PlayerId ) =>
	frame.responses.find( response => response.playerId === playerId );

/**
 * The answers a window actually received — passes and timeouts left out.
 *
 * What a game's `onResolve` almost always wants: an empty list means nobody
 * objected and the action it was guarding goes through, and a `first` window can
 * only ever put one entry in it.
 *
 * @param frame - The settled window.
 * @returns The responses that named a move, in the order they were given.
 */
export const answersOf = ( frame: InteractionFrame ) =>
	frame.responses.filter( response => response.outcome === "answered" );

/**
 * The single answer a `first` window received, if it received one.
 *
 * @param frame - The settled window.
 * @returns The winning response, or `undefined` when the window went unanswered.
 */
export const firstAnswer = ( frame: InteractionFrame ) => answersOf( frame )[ 0 ];


// --- Redaction -------------------------------------------------------------

/**
 * Hides what a secret window's responders have said from everyone but themselves.
 *
 * Applied to the context on its way into a `GameView`, alongside the game's own
 * `view`, so a simultaneous choice — everybody bidding, everybody picking a card
 * at once — can be collected through the same machinery as a public one without
 * the engine handing the answers round as they arrive.
 *
 * What stays visible is *that* a responder has answered: `pending` is left alone,
 * so a client can still show who the table is waiting on. Only the move is
 * withheld, and only from other people.
 *
 * @param context - The context as the record holds it.
 * @param audience - Who the view is being built for.
 * @returns The context with every secret window's answers redacted for that audience.
 */
export const redactInteractions = ( context: GameContext, audience: Audience ) => {
	if ( !context.interactions.some( frame => frame.secret ) ) {
		return context;
	}

	const viewer = Match.value( audience ).pipe(
		Match.tag( "swish/PlayerAudience", a => a.playerId ),
		Match.tag( "swish/TableAudience", () => undefined ),
		Match.exhaustive
	);

	const interactions = context.interactions.map( frame => frame.secret
		? {
			...frame,
			responses: frame.responses.map( response => response.playerId === viewer
				? response
				: { ...response, move: undefined } )
		}
		: frame );

	return { ...context, interactions };
};


// --- Guards ----------------------------------------------------------------

/**
 * Asserts the caller holds a seat. Every command but `initialize` and `join`
 * runs this: the entity trusts the `playerId` it is handed, because only the
 * HTTP layer — which authenticated it — can reach the entity at all.
 */
export const assertMember = <State, Config extends BaseGameConfig>(
	record: GameRecord<State, Config>,
	playerId: PlayerId
) => record.players[ playerId ]
	? Effect.void
	: Effect.fail( new NotAMember( { playerId } ) );

/**
 * Asserts the game is being played, rather than filling up or already over.
 */
export const assertInProgress = <State, Config extends BaseGameConfig>(
	record: GameRecord<State, Config>
) => record.status === "IN_PROGRESS"
	? Effect.void
	: Effect.fail( new GameNotInProgress( { status: record.status } ) );

/**
 * Asserts the table is still open. `PLAYERS_READY` is deliberately not joinable:
 * the roster is full at that point, and the only thing left to do is start.
 */
export const assertJoinable = <State, Config extends BaseGameConfig>(
	record: GameRecord<State, Config>
) => record.status === "CREATED"
	? Effect.void
	: Effect.fail( new GameNotJoinable( { status: record.status } ) );

/**
 * Asserts there is a seat left to take.
 */
export const assertHasSeat = <State, Config extends BaseGameConfig>(
	record: GameRecord<State, Config>
) => Object.keys( record.players ).length < record.config.playerCount
	? Effect.void
	: Effect.fail( new GameFull( { playerCount: record.config.playerCount } ) );

/**
 * Asserts this player does not already hold a seat.
 */
export const assertNotJoined = <State, Config extends BaseGameConfig>(
	record: GameRecord<State, Config>,
	playerId: PlayerId
) => record.players[ playerId ]
	? Effect.fail( new AlreadyJoined( { playerId } ) )
	: Effect.void;

/**
 * Asserts every seat is taken and the game has not started.
 */
export const assertCanStart = <State, Config extends BaseGameConfig>(
	record: GameRecord<State, Config>
) => record.status === "PLAYERS_READY"
&& Object.keys( record.players ).length === record.config.playerCount
	? Effect.void
	: Effect.fail( new CannotStart( { status: record.status } ) );

/**
 * Reads the seat whose turn it is.
 *
 * `currentPlayer` is optional because an empty table has nobody to name, but a
 * game that is `IN_PROGRESS` and still has none is not a state any sequence of
 * events can reach — so this reports it as a game that is not in progress rather
 * than letting a missing seat travel any further.
 */
export const requireCurrentPlayer = <State, Config extends BaseGameConfig>(
	record: GameRecord<State, Config>
) => record.context.currentPlayer
	? Effect.succeed( record.context.currentPlayer )
	: Effect.fail( new GameNotInProgress( { status: record.status } ) );


/**
 * Asserts nothing is being decided right now.
 *
 * What `undo` and `redo` run, and what the move path falls back to when a move
 * turns out not to be one of the open window's options. A suspended turn is not a
 * turn anybody may take.
 */
export const assertNoOpenInteraction = <State, Config extends BaseGameConfig>(
	record: GameRecord<State, Config>
) => {
	const frame = activeFrame( record.context );
	return frame
		? Effect.fail( new InteractionInProgress( { frameId: frame.id, kind: frame.kind } ) )
		: Effect.void;
};

/**
 * Reads the window a player is answering, checking it is the one they meant.
 *
 * `frameId` is what a client saw when it drew the buttons. Checking it is what
 * stops a click that was meant for a window which has since settled from landing
 * on the one that replaced it — a real race in a game where one answer opens the
 * next question in the same commit.
 *
 * @param record - The record holding the stack.
 * @param playerId - The player answering.
 * @param frameId - The window they believe they are answering, if they said.
 * @returns The open window, or the reason it cannot be answered.
 */
export const requireActiveFrame = <State, Config extends BaseGameConfig>(
	record: GameRecord<State, Config>,
	playerId: PlayerId,
	frameId?: string
): Effect.Effect<
	InteractionFrame,
	InteractionNotOpen | InteractionStale | NotRespondingTo
> => {
	const frame = activeFrame( record.context );

	if ( !frame ) {
		return Effect.fail( new InteractionNotOpen( { playerId } ) );
	}

	if ( frameId !== undefined && frameId !== frame.id ) {
		return Effect.fail( new InteractionStale( { expected: frameId, actual: frame.id } ) );
	}

	if ( !frame.pending.includes( playerId ) ) {
		return Effect.fail( new NotRespondingTo( { playerId, frameId: frame.id } ) );
	}

	return Effect.succeed( frame );
};


export const requireTeams = ( name: string, config: BaseGameConfig ) => {
	return config.teams
		? Effect.succeed( config.teams )
		: Effect.fail( new TeamsUnavailable( { game: name } ) );
};
