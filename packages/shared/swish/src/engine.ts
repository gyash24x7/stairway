// @s2h/swish/engine — the engine runtime (CQRS + event sourcing).
//
// Server-only, Cloudflare-free: every action is an `Effect` over the service
// tags in `./services`. Commands (join/start/submitMove/undo/redo/…) are the
// only event producers; a query (getState) is a pure read of the snapshot.
//
// A command's shape is: load the current snapshot → validate (may fail, emits
// nothing) → decide (run deciders, EMIT events, fold each batch onto a working
// copy) → commit ONCE (append the commit to the append-only `EventStore` + save
// the new snapshot to `GameStore`). State only ever changes inside `fold`
// (`events.ts`), so the whole game is replayable and undo/redo is a cursor move
// + refold.

import { Clock, Effect, Option, Schema } from "effect";
import {
	CannotStart,
	CorruptState,
	GameFull,
	GameNotFound,
	GameNotInProgress,
	MoveError,
	MoveNotAllowed,
	NothingToRedo,
	NothingToUndo,
	NotYourTurn,
	PhaseNotFound
} from "./errors";
import {
	CurrentPlayerSet,
	type EngineEvent,
	foldEvents,
	GameCompleted,
	makeCommitSchema,
	PhaseEntered,
	PhaseExited,
	PlayerJoined,
	StatusChanged,
	TurnAdvanced
} from "./events";
import {
	type BaseGameConfig,
	CompletedGameData,
	type GameCode,
	GameContext,
	GameId,
	type GameSnapshot as GameSnapshotType,
	PersistedGameData,
	PlayerId,
	PlayerInfo
} from "./schema";
import { EventStore, GameArchive, GameRepo, GameStore, Ids, Scheduler } from "./services";
import { type GameStructure, type MoveMap } from "./structure";

/** The full set of host services every engine program may require. */
export type EngineServices = GameStore | Scheduler | GameArchive | GameRepo | Ids | EventStore;

const BOT_DELAY_MS = 5000;
const AUTO_START_DELAY_MS = 5000;

// A game structure with concrete generics erased down to what the engine needs.
type Struct<State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R> =
	GameStructure<State, Config, Ev, M, SV, PV, R>;

// A folding accumulator: the events emitted so far + the running work state.
interface Acc<State, Config, Ev> {
	events: Array<EngineEvent | Ev>;
	work: PersistedGameData<State, Config>;
}

const persistedSchema = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>
) => PersistedGameData( structure.stateSchema, structure.configSchema );

const commitSchema = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>
) => makeCommitSchema( structure.eventSchema );

const readonly = <State, Config extends BaseGameConfig>(
	data: PersistedGameData<State, Config>
) => ( {
	state: data.state,
	config: data.config,
	context: data.context
} );

/** Fold events onto a record via the game's `apply` (the only state-changer). */
const fold = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>,
	data: PersistedGameData<State, Config>,
	events: ReadonlyArray<EngineEvent | Ev>
): PersistedGameData<State, Config> => foldEvents( structure.apply, data, events );

// --- storage helpers -------------------------------------------------------

const load = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>
) =>
	Effect.gen( function* () {
		const store = yield* GameStore;
		const raw = yield* store.load;
		if ( Option.isNone( raw ) ) {
			return yield* new GameNotFound( { id: GameId.make( "unknown" ) } );
		}
		return yield* Schema.decodeUnknownEffect( persistedSchema( structure ) )( raw.value ).pipe(
			Effect.mapError( ( issue ) => new CorruptState( {
				id: GameId.make( "unknown" ),
				reason: String( issue )
			} ) )
		);
	} );

const save = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>,
	data: PersistedGameData<State, Config>
) =>
	Effect.gen( function* () {
		const store = yield* GameStore;
		const encoded = yield* Schema.encodeUnknownEffect( persistedSchema( structure ) )( data )
			.pipe( Effect.orDie );
		yield* store.save( encoded );
	} );

const snapshot = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>,
	data: PersistedGameData<State, Config>,
	playerId: PlayerId
) =>
	Effect.gen( function* () {
		const rd = readonly( data );
		const shared = yield* structure.sharedView( rd );
		const player = yield* structure.playerView( rd, playerId );
		return {
			_tag: "swish/GameSnapshot" as const,
			id: data.id,
			code: data.code,
			status: data.status,
			context: data.context,
			players: data.players,
			shared,
			player
		};
	} );

const scheduleBotIfNeeded = <State, Config>( data: PersistedGameData<State, Config> ) =>
	Effect.gen( function* () {
		const scheduler = yield* Scheduler;
		if ( data.status !== "IN_PROGRESS" ) {
			return;
		}
		const current = data.players[ data.context.currentPlayer ];
		if ( current?.isBot ) {
			yield* scheduler.schedule( BOT_DELAY_MS, "bot" );
		}
	} );

const archive = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>,
	data: PersistedGameData<State, Config>
) =>
	Effect.gen( function* () {
		const arch = yield* GameArchive;
		const repo = yield* GameRepo;
		const rd = readonly( data );
		const shared = yield* structure.sharedView( rd );
		const playerViews: Record<string, unknown> = {};
		for ( const player of Object.values( data.players ) ) {
			playerViews[ player.id ] = yield* structure.playerView( rd, player.id );
		}
		const completed = {
			_tag: "swish/CompletedGameData" as const,
			id: data.id,
			code: data.code,
			status: data.status,
			context: data.context,
			players: data.players,
			shared,
			playerViews
		};
		const encoded = yield* Schema.encodeUnknownEffect(
			CompletedGameData( structure.sharedViewSchema, structure.playerViewSchema )
		)( completed ).pipe( Effect.orDie );
		yield* arch.put( `${ structure.name }:${ data.id }`, encoded );
		yield* repo.markCompleted( data.id );
	} );

// --- event-sourcing helpers ------------------------------------------------

/**
 * Persist one command: mint id + timestamp, encode the commit, append it to the
 * log (dropping any redo tail), and save the new snapshot. The single commit
 * point of a command.
 */
const commitAndSave = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>,
	work: PersistedGameData<State, Config>,
	meta: { command: string; actor?: PlayerId; moveType?: string },
	events: ReadonlyArray<EngineEvent | Ev>
) =>
	Effect.gen( function* () {
		const ids = yield* Ids;
		const log = yield* EventStore;
		const id = yield* ids.commitId;
		const at = yield* Clock.currentTimeMillis;
		const commit = {
			id,
			command: meta.command,
			actor: meta.actor,
			moveType: meta.moveType,
			at,
			events
		};
		const encoded = yield* Schema.encodeUnknownEffect( commitSchema( structure ) )( commit )
			.pipe( Effect.orDie );
		yield* log.append( encoded );
		yield* save( structure, work );
	} );

/** Enter a phase: emit PhaseEntered, run `onEnter`, set the starting player. */
const enterPhase = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>,
	from: PersistedGameData<State, Config>,
	phaseName: string
) =>
	Effect.gen( function* () {
		const phase = structure.phases?.[ phaseName ];
		if ( !phase ) {
			return yield* new PhaseNotFound( { phase: phaseName } );
		}
		const acc: Acc<State, Config, Ev> = { events: [], work: from };
		const emit = ( es: ReadonlyArray<EngineEvent | Ev> ) => {
			acc.events.push( ...es );
			acc.work = fold( structure, acc.work, es );
		};
		emit( [ PhaseEntered.make( { phase: phaseName } ) ] );
		if ( phase.onEnter ) {
			emit( yield* phase.onEnter( readonly( acc.work ) ) );
		}
		if ( phase.resolveStartingPlayer ) {
			const starting = yield* phase.resolveStartingPlayer( readonly( acc.work ) );
			emit( [ CurrentPlayerSet.make( { playerId: starting } ) ] );
		}
		return acc;
	} );

/** Refold the current state from the log's genesis up to the cursor. */
const refold = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>
) =>
	Effect.gen( function* () {
		const log = yield* EventStore;
		const { base, commits, cursor } = yield* log.read;
		const corrupt = ( issue: unknown ) => new CorruptState( {
			id: GameId.make( "unknown" ),
			reason: String( issue )
		} );
		let work = yield* Schema.decodeUnknownEffect( persistedSchema( structure ) )( base )
			.pipe( Effect.mapError( corrupt ) );
		for ( const raw of commits.slice( 0, cursor + 1 ) ) {
			const commit = yield* Schema.decodeUnknownEffect( commitSchema( structure ) )( raw )
				.pipe( Effect.mapError( corrupt ) );
			work = fold( structure, work, commit.events );
		}
		return work;
	} );

/** After undo/redo: cancel any stale bot alarm and reschedule for the new turn. */
const reconcile = <State, Config>( work: PersistedGameData<State, Config> ) =>
	Effect.gen( function* () {
		const scheduler = yield* Scheduler;
		yield* scheduler.cancel;
		yield* scheduleBotIfNeeded( work );
	} );

// --- lifecycle commands ----------------------------------------------------

const initialize = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>,
	// `config` is already decoded by the RPC boundary; the engine trusts it.
	payload: { id: GameId; code: GameCode; config: Config }
) =>
	Effect.gen( function* () {
		const store = yield* GameStore;
		const log = yield* EventStore;
		const state = yield* structure.setup( payload.config );
		const genesis: PersistedGameData<State, Config> = {
			_tag: "swish/PersistedGameData",
			version: 1,
			id: payload.id,
			code: payload.code,
			status: "CREATED",
			context: GameContext.make( { turn: 0, players: [], currentPlayer: PlayerId.make( "" ) } ),
			players: {},
			config: payload.config,
			state
		};
		const encoded = yield* Schema.encodeUnknownEffect( persistedSchema( structure ) )( genesis )
			.pipe( Effect.orDie );
		yield* log.setBase( encoded );
		yield* store.save( encoded );
	} ).pipe( Effect.withSpan( "engine.initialize" ) );

const join = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>,
	player: PlayerInfo
) =>
	Effect.gen( function* () {
		const scheduler = yield* Scheduler;
		const data = yield* load( structure );
		if ( data.players[ player.id ] ) {
			return;
		} // idempotent re-join
		if ( Object.keys( data.players ).length >= data.config.playerCount ) {
			return yield* new GameFull( { playerCount: data.config.playerCount } );
		}

		const acc: Acc<State, Config, Ev> = { events: [], work: data };
		const emit = ( es: ReadonlyArray<EngineEvent | Ev> ) => {
			acc.events.push( ...es );
			acc.work = fold( structure, acc.work, es );
		};

		if ( structure.hooks?.onJoin ) {
			emit( yield* structure.hooks.onJoin(
				readonly( acc.work ),
				player.id
			) );
		}
		emit( [ PlayerJoined.make( { player } ) ] );

		const nowFull = Object.keys( acc.work.players ).length >= acc.work.config.playerCount;
		if ( nowFull &&
			!acc.work.config.autoStart ) {
			emit( [ StatusChanged.make( { status: "PLAYERS_READY" } ) ] );
		}

		yield* commitAndSave( structure, acc.work, { command: "join", actor: player.id }, acc.events );
		if ( nowFull && acc.work.config.autoStart ) {
			yield* scheduler.schedule(
				AUTO_START_DELAY_MS,
				"auto-start"
			);
		}
	} ).pipe( Effect.withSpan( "engine.join" ) );

const start = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>
) =>
	Effect.gen( function* () {
		const data = yield* load( structure );
		const count = Object.keys( data.players ).length;
		if ( data.status ===
			"IN_PROGRESS" ||
			data.status ===
			"COMPLETED" ||
			count <
			data.config.playerCount ) {
			return yield* new CannotStart( { status: data.status } );
		}

		const acc: Acc<State, Config, Ev> = { events: [], work: data };
		const emit = ( es: ReadonlyArray<EngineEvent | Ev> ) => {
			acc.events.push( ...es );
			acc.work = fold( structure, acc.work, es );
		};

		if ( structure.hooks?.onStart ) {
			emit( yield* structure.hooks.onStart( readonly( acc.work ) ) );
		}
		if ( structure.phases ) {
			const entered = yield* enterPhase( structure, acc.work, structure.initialPhase );
			acc.events.push( ...entered.events );
			acc.work = entered.work;
		}
		emit( [ StatusChanged.make( { status: "IN_PROGRESS" } ) ] );

		yield* commitAndSave( structure, acc.work, { command: "start" }, acc.events );
		yield* scheduleBotIfNeeded( acc.work );
	} ).pipe( Effect.withSpan( "engine.start" ) );

const submitMove = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, MoveType extends keyof M, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>,
	moveType: MoveType,
	input: Schema.Schema.Type<M[MoveType][ "input" ]>,
	playerId: PlayerId
) =>
	Effect.gen( function* () {
		const data = yield* load( structure );
		if ( data.status !== "IN_PROGRESS" ) {
			return yield* new GameNotInProgress( { status: data.status } );
		}

		const phaseName = data.context.phase ??
			( structure.phases ? structure.initialPhase : undefined );
		const phase = structure.phases && phaseName ? structure.phases[ phaseName ] : undefined;
		if ( structure.phases && !phase ) {
			return yield* new PhaseNotFound( { phase: phaseName ?? "" } );
		}

		const moveDef = phase ? phase.moves[ moveType ] : structure.moves?.[ moveType ];
		if ( !moveDef ) {
			return yield* new MoveNotAllowed( { move: String( moveType ) } );
		}

		const allowed = moveDef.canMove
			? yield* moveDef.canMove( readonly( data ), playerId )
			: data.context.currentPlayer === playerId;
		if ( !allowed ) {
			return yield* new NotYourTurn( { playerId, currentPlayer: data.context.currentPlayer } );
		}

		yield* moveDef.validate( readonly( data ), playerId, input );

		// decide — emit events, fold onto the working copy as we go
		const acc: Acc<State, Config, Ev> = { events: [], work: data };
		const emit = ( es: ReadonlyArray<EngineEvent | Ev> ) => {
			acc.events.push( ...es );
			acc.work = fold( structure, acc.work, es );
		};
		const move = String( moveType );

		if ( phase?.hooks?.beforeMove ) {
			emit( yield* phase.hooks.beforeMove(
				readonly( acc.work ),
				playerId,
				move
			) );
		}
		if ( structure.hooks?.beforeMove ) {
			emit( yield* structure.hooks.beforeMove(
				readonly( acc.work ),
				playerId,
				move
			) );
		}
		emit( yield* moveDef.execute( readonly( acc.work ), playerId, input ) );
		if ( structure.hooks?.afterMove ) {
			emit( yield* structure.hooks.afterMove(
				readonly( acc.work ),
				playerId,
				move
			) );
		}
		if ( phase?.hooks?.afterMove ) {
			emit( yield* phase.hooks.afterMove(
				readonly( acc.work ),
				playerId,
				move
			) );
		}

		emit( [ TurnAdvanced.make( {} ) ] );

		if ( structure.phases && phase ) {
			const phaseEnded = yield* phase.endIf( readonly( acc.work ) );
			if ( phaseEnded ) {
				const nextPhaseName = yield* phase.resolveNextPhase( readonly( acc.work ) );
				if ( phase.onExit ) {
					emit( yield* phase.onExit( readonly( acc.work ) ) );
				}
				emit( [ PhaseExited.make( { phase: phaseName ?? "" } ) ] );
				const entered = yield* enterPhase( structure, acc.work, nextPhaseName );
				acc.events.push( ...entered.events );
				acc.work = entered.work;
			} else {
				const next = yield* phase.resolveNextPlayer( readonly( acc.work ), playerId, move );
				emit( [ CurrentPlayerSet.make( { playerId: next } ) ] );
			}
		} else if ( !structure.phases ) {
			const next = yield* structure.resolveNextPlayer( readonly( acc.work ), playerId, move );
			emit( [ CurrentPlayerSet.make( { playerId: next } ) ] );
		}

		const ended = yield* structure.endIf( readonly( acc.work ) );
		if ( ended ) {
			if ( structure.hooks?.onEnd ) {
				emit( yield* structure.hooks.onEnd( readonly( acc.work ) ) );
			}
			emit( [ GameCompleted.make( {} ) ] );
		}

		yield* commitAndSave(
			structure,
			acc.work,
			{ command: "submitMove", actor: playerId, moveType: move },
			acc.events
		);
		if ( acc.work.status === "COMPLETED" ) {
			yield* archive( structure, acc.work );
		} else {
			yield* scheduleBotIfNeeded( acc.work );
		}
	} )
		.pipe( Effect.withSpan(
			"engine.submitMove",
			{ attributes: { moveType: String( moveType ) } }
		) );

const getState = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>,
	playerInfo: PlayerInfo
) =>
	Effect.gen( function* () {
		const data = yield* load( structure );
		return yield* snapshot( structure, data, playerInfo.id );
	} ).pipe( Effect.withSpan( "engine.getState" ) );

const addBots = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>
) =>
	Effect.gen( function* () {
		const ids = yield* Ids;
		const data = yield* load( structure );
		const remaining = data.config.playerCount - Object.keys( data.players ).length;
		for ( let i = 0; i < remaining; i++ ) {
			const bot = yield* ids.botIdentity;
			yield* join(
				structure,
				PlayerInfo.make( {
					id: PlayerId.make( bot.id ),
					name: bot.name,
					avatar: bot.avatar,
					isBot: true
				} )
			);
		}
	} ).pipe( Effect.withSpan( "engine.addBots" ) );

const undo = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>,
	playerId: PlayerId
) =>
	Effect.gen( function* () {
		const log = yield* EventStore;
		const moved = yield* log.moveCursor( -1 );
		if ( Option.isNone( moved ) ) {
			return yield* new NothingToUndo();
		}
		const work = yield* refold( structure );
		yield* save( structure, work );
		yield* reconcile( work );
		return yield* snapshot( structure, work, playerId );
	} ).pipe( Effect.withSpan( "engine.undo" ) );

const redo = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>,
	playerId: PlayerId
) =>
	Effect.gen( function* () {
		const log = yield* EventStore;
		const moved = yield* log.moveCursor( 1 );
		if ( Option.isNone( moved ) ) {
			return yield* new NothingToRedo();
		}
		const work = yield* refold( structure );
		yield* save( structure, work );
		yield* reconcile( work );
		return yield* snapshot( structure, work, playerId );
	} ).pipe( Effect.withSpan( "engine.redo" ) );

const cleanup = () =>
	Effect.gen( function* () {
		const scheduler = yield* Scheduler;
		const store = yield* GameStore;
		yield* scheduler.cancel;
		yield* store.clear;
	} );

/**
 * The Durable Object alarm entry point. Fires a scheduled auto-start or plays
 * the current bot's move. Failures are logged, not thrown (an alarm must not
 * throw back into the runtime).
 */
const runBotTurn = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R>(
	structure: Struct<State, Config, Ev, M, SV, PV, R>
) =>
	Effect.gen( function* () {
		const scheduler = yield* Scheduler;
		const kind = yield* scheduler.read;
		if ( Option.isSome( kind ) && kind.value === "auto-start" ) {
			yield* start( structure ).pipe(
				Effect.catchCause( ( cause ) => Effect.logError(
					"engine.runBotTurn: auto-start failed",
					cause
				) )
			);
			return;
		}

		const data = yield* load( structure ).pipe( Effect.catch( () => Effect.succeed( null ) ) );
		if ( !data || data.status !== "IN_PROGRESS" ) {
			return;
		}
		const current = data.players[ data.context.currentPlayer ];
		if ( !current?.isBot ) {
			return;
		}

		const phaseName = data.context.phase ??
			( structure.phases ? structure.initialPhase : undefined );
		const phase = structure.phases && phaseName ? structure.phases[ phaseName ] : undefined;
		const botFn = phase ? phase.botMove : structure.botMove;
		if ( !botFn ) {
			return;
		}

		const rd = readonly( data );
		const shared = yield* structure.sharedView( rd );
		const player = yield* structure.playerView( rd, current.id );
		const move = yield* botFn( {
			state: { ...shared, ...player },
			config: data.config,
			context: data.context
		} );
		yield* submitMove( structure, move.moveType, move.input, current.id ).pipe(
			Effect.catchCause( ( cause ) => Effect.logError(
				"engine.runBotTurn: bot move failed",
				cause
			) )
		);
	} ).pipe( Effect.withSpan( "engine.runBotTurn" ) );

/**
 * The public engine surface. One instance drives a single game's whole
 * lifecycle over the host services. `submitMove` is generic per move so each
 * move's `input` keeps its exact decoded type. Commands produce events;
 * `getState` is a pure read. `undo`/`redo` move the log cursor and refold.
 */
export interface Engine<State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R = never> {
	readonly initialize: ( payload: { id: GameId; code: GameCode; config: Config } ) =>
		Effect.Effect<void, never, EngineServices | R>;
	readonly getState: ( playerInfo: PlayerInfo ) =>
		Effect.Effect<GameSnapshotType<SV, PV>, GameNotFound | CorruptState, EngineServices | R>;
	readonly join: ( playerInfo: PlayerInfo ) =>
		Effect.Effect<void, GameFull | GameNotFound | CorruptState, EngineServices | R>;
	readonly addBots: () =>
		Effect.Effect<void, GameFull | GameNotFound | CorruptState, EngineServices | R>;
	readonly start: () =>
		Effect.Effect<void, CannotStart | GameNotFound | CorruptState | PhaseNotFound, EngineServices | R>;
	readonly submitMove: <MoveType extends keyof M>(
		moveType: MoveType,
		playerInfo: PlayerInfo,
		input: Schema.Schema.Type<M[MoveType][ "input" ]>
	) => Effect.Effect<void, Schema.Schema.Type<typeof MoveError>, EngineServices | R>;
	readonly undo: ( playerInfo: PlayerInfo ) =>
		Effect.Effect<GameSnapshotType<SV, PV>, NothingToUndo | GameNotFound | CorruptState, EngineServices | R>;
	readonly redo: ( playerInfo: PlayerInfo ) =>
		Effect.Effect<GameSnapshotType<SV, PV>, NothingToRedo | GameNotFound | CorruptState, EngineServices | R>;
	readonly runBotTurn: () => Effect.Effect<void, never, EngineServices | R>;
	readonly cleanup: () => Effect.Effect<void, never, EngineServices | R>;
}

/**
 * Build the engine for a game. Accepts flat or phased structures; the returned
 * methods are the game-agnostic lifecycle plus a generic `submitMove` and the
 * additive `undo`/`redo`. Games wire these onto their RPCs in `toLayer`.
 */
export const makeEngine = <State, Config extends BaseGameConfig, Ev extends {
	readonly _tag: string
}, M extends MoveMap<State, Config, Ev, R>, SV, PV, R = never>(
	structure: GameStructure<State, Config, Ev, M, SV, PV, R>
): Engine<State, Config, Ev, M, SV, PV, R> => ( {
	initialize: ( payload ) => initialize( structure, payload ),
	getState: ( playerInfo ) => getState( structure, playerInfo ),
	join: ( playerInfo ) => join( structure, playerInfo ),
	addBots: () => addBots( structure ),
	start: () => start( structure ),
	submitMove: ( moveType, playerInfo, input ) => submitMove(
		structure,
		moveType,
		input,
		playerInfo.id
	),
	undo: ( playerInfo ) => undo( structure, playerInfo.id ),
	redo: ( playerInfo ) => redo( structure, playerInfo.id ),
	runBotTurn: () => runBotTurn( structure ),
	cleanup: () => cleanup()
} );
