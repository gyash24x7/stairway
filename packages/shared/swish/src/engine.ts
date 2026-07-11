// @s2h/swish/engine — the engine runtime.
//
// Server-only, but Cloudflare-free: every lifecycle action is an `Effect` over
// the service tags in `./services`, never over `ctx.storage`/KV/D1 directly.
// The heart of the old class engine's `executeMove` becomes `submitMove`: it
// computes the next persisted record as a *value* and writes it exactly once at
// the end, so a mid-pipeline failure can never persist partial state.

import { Effect, Option, Schema } from "effect";
import {
	CannotStart,
	CorruptState,
	GameFull,
	GameNotFound,
	GameNotInProgress,
	MoveError,
	MoveNotAllowed,
	NotYourTurn,
	PhaseNotFound
} from "./errors";
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
import { GameArchive, GameRepo, GameStore, Ids, Scheduler } from "./services";
import { type GameStructure, type MoveMap } from "./structure";

/** The full set of host services every engine program may require. */
export type EngineServices = GameStore | Scheduler | GameArchive | GameRepo | Ids;

const BOT_DELAY_MS = 5000;
const AUTO_START_DELAY_MS = 5000;

const persistedSchema = <
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	SV,
	PV,
	R = never
>( structure: GameStructure<State, Config, M, SV, PV, R> ) =>
	PersistedGameData( structure.stateSchema, structure.configSchema );

const readonly = <State, Config>( data: PersistedGameData<State, Config> ) => ( {
	state: data.state,
	config: data.config,
	context: data.context
} );

const withState = <State, Config>(
	data: PersistedGameData<State, Config>,
	state: State
) => ( { ...data, state } );

const contextWith = ( ctx: GameContext, patch: Partial<GameContext> ): GameContext =>
	new GameContext( {
		turn: patch.turn ?? ctx.turn,
		players: patch.players ?? ctx.players,
		currentPlayer: patch.currentPlayer ?? ctx.currentPlayer,
		phase: patch.phase ?? ctx.phase
	} );

// --- storage helpers -------------------------------------------------------

const load = <
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	SV,
	PV,
	R = never
>( structure: GameStructure<State, Config, M, SV, PV, R> ) =>
	Effect.gen( function* () {
		const store = yield* GameStore;
		const raw = yield* store.load;
		if ( Option.isNone( raw ) ) {
			return yield* Effect.fail( new GameNotFound( { id: GameId.make( "unknown" ) } ) );
		}
		return yield* Schema.decodeUnknownEffect( persistedSchema( structure ) )( raw.value ).pipe(
			Effect.mapError( ( issue ) => new CorruptState( {
				id: GameId.make( "unknown" ),
				reason: String( issue )
			} ) )
		);
	} );

const save = <
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	SV,
	PV,
	R = never
>(
	structure: GameStructure<State, Config, M, SV, PV, R>,
	data: PersistedGameData<State, Config>
) =>
	Effect.gen( function* () {
		const store = yield* GameStore;
		const encoded = yield* Schema.encodeUnknownEffect( persistedSchema( structure ) )( data )
			.pipe( Effect.orDie );
		yield* store.save( encoded );
	} );

const snapshot = <
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	SV,
	PV,
	R = never
>(
	structure: GameStructure<State, Config, M, SV, PV, R>,
	data: PersistedGameData<State, Config>,
	playerId: PlayerId
) =>
	Effect.gen( function* () {
		const rd = readonly( data );
		const shared = yield* structure.sharedView( rd );
		const player = yield* structure.playerView( rd, playerId );
		return {
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

const archive = <
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	SV,
	PV,
	R = never
>(
	structure: GameStructure<State, Config, M, SV, PV, R>,
	data: PersistedGameData<State, Config>
) =>
	Effect.gen( function* () {
		const arch = yield* GameArchive;
		const repo = yield* GameRepo;
		const rd = readonly( data );
		const shared = yield* structure.sharedView( rd );
		const playerViews: Record<string, unknown> = {};
		// Iterate values, not keys: `PlayerInfo.id` is already a branded `PlayerId`,
		// whereas `Object.keys` widens to `string`.
		for ( const player of Object.values( data.players ) ) {
			playerViews[ player.id ] = yield* structure.playerView( rd, player.id );
		}
		const completed = {
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

// --- lifecycle programs ----------------------------------------------------

const initialize = <
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	SV,
	PV,
	R = never
>(
	structure: GameStructure<State, Config, M, SV, PV, R>,
	// `config` is already decoded: the `initialize` RPC validates it against the
	// game's `configSchema` on the wire, so the engine trusts it here (no
	// redundant — and, for branded/transformed configs, failing — re-decode).
	payload: { id: GameId; code: GameCode; config: Config }
) =>
	Effect.gen( function* () {
		const state = yield* structure.setup( payload.config );
		const data = {
			version: 1,
			id: payload.id,
			code: payload.code,
			status: "CREATED" as const,
			context: new GameContext( { turn: 0, players: [], currentPlayer: PlayerId.make( "" ) } ),
			players: {},
			config: payload.config,
			state
		};

		yield* save( structure, data );
	} ).pipe( Effect.withSpan( "engine.initialize" ) );

const join = <
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	SV,
	PV,
	R = never
>(
	structure: GameStructure<State, Config, M, SV, PV, R>,
	player: PlayerInfo
) =>
	Effect.gen( function* () {
		const scheduler = yield* Scheduler;
		const data = yield* load( structure );
		if ( data.players[ player.id ] ) {
			return;
		} // idempotent re-join

		const count = Object.keys( data.players ).length;
		if ( count >= data.config.playerCount ) {
			return yield* Effect.fail( new GameFull( { playerCount: data.config.playerCount } ) );
		}

		const players = { ...data.players, [ player.id ]: player };
		const playerIds = [ ...data.context.players, player.id ];
		const currentPlayer = data.context.players.length === 0
			? player.id
			: data.context.currentPlayer;

		let state = data.state;
		if ( structure.hooks?.onJoin ) {
			state = yield* structure.hooks.onJoin( readonly( data ), player.id );
		}

		const nowFull = playerIds.length >= data.config.playerCount;
		const status = nowFull && !data.config.autoStart ? "PLAYERS_READY" : data.status;
		const context = contextWith( data.context, { players: playerIds, currentPlayer } );

		const next = { ...data, players, context, state, status };
		yield* save( structure, next );

		if ( nowFull && data.config.autoStart ) {
			yield* scheduler.schedule( AUTO_START_DELAY_MS, "auto-start" );
		}
	} ).pipe( Effect.withSpan( "engine.join" ) );

const start = <
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	SV,
	PV,
	R = never
>( structure: GameStructure<State, Config, M, SV, PV, R> ) =>
	Effect.gen( function* () {
		const data = yield* load( structure );
		const count = Object.keys( data.players ).length;
		if ( data.status ===
			"IN_PROGRESS" ||
			data.status ===
			"COMPLETED" ||
			count <
			data.config.playerCount ) {
			return yield* Effect.fail( new CannotStart( { status: data.status } ) );
		}

		let state = data.state;
		if ( structure.hooks?.onStart ) {
			state =
				yield* structure.hooks.onStart( readonly( withState( data, state ) ) );
		}

		let context = data.context;
		if ( structure.phases ) {
			const entered = yield* enterPhase(
				structure,
				withState( data, state ),
				structure.initialPhase
			);
			state = entered.state;
			context = entered.context;
		}

		const next = { ...data, state, context, status: "IN_PROGRESS" as const };
		yield* save( structure, next );
		yield* scheduleBotIfNeeded( next );
	} ).pipe( Effect.withSpan( "engine.start" ) );

/** Enter a phase: mark it current, run `onEnter`, pick the starting player. */
const enterPhase = <
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	SV,
	PV,
	R = never
>(
	structure: GameStructure<State, Config, M, SV, PV, R>,
	data: PersistedGameData<State, Config>,
	phaseName: string
) =>
	Effect.gen( function* () {
		if ( !structure.phases ) {
			return { state: data.state, context: data.context };
		}
		const phase = structure.phases[ phaseName ];
		if ( !phase ) {
			return yield* Effect.fail( new PhaseNotFound( { phase: phaseName } ) );
		}

		let context = contextWith( data.context, { phase: phaseName } );
		let state = data.state;
		if ( phase.onEnter ) {
			state = yield* phase.onEnter( readonly( { ...data, context } ) );
		}
		if ( phase.resolveStartingPlayer ) {
			const starting = yield* phase.resolveStartingPlayer(
				readonly( withState( { ...data, context }, state ) )
			);
			context = contextWith( context, { currentPlayer: starting } );
		}
		return { state, context };
	} );

const transitionToPhase = <
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	SV,
	PV,
	R = never
>(
	structure: GameStructure<State, Config, M, SV, PV, R>,
	data: PersistedGameData<State, Config>,
	fromPhase: string | undefined,
	toPhase: string
) =>
	Effect.gen( function* () {
		let state = data.state;
		if ( structure.phases && fromPhase ) {
			const prev = structure.phases[ fromPhase ];
			if ( prev?.onExit ) {
				state = yield* prev.onExit( readonly( data ) );
			}
		}
		return yield* enterPhase( structure, withState( data, state ), toPhase );
	} );

const submitMove = <
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	MoveType extends keyof M,
	SV,
	PV,
	R = never
>(
	structure: GameStructure<State, Config, M, SV, PV, R>,
	moveType: MoveType,
	input: Schema.Schema.Type<M[MoveType]["input"]>,
	playerId: PlayerId
) =>
	Effect.gen( function* () {
		const data = yield* load( structure );
		if ( data.status !== "IN_PROGRESS" ) {
			return yield* Effect.fail( new GameNotInProgress( { status: data.status } ) );
		}

		const phaseName = data.context.phase ??
			( structure.phases ? structure.initialPhase : undefined );
		const phase = structure.phases && phaseName ? structure.phases[ phaseName ] : undefined;
		if ( structure.phases && !phase ) {
			return yield* Effect.fail( new PhaseNotFound( { phase: phaseName ?? "" } ) );
		}

		const moveDef = phase ? phase.moves[ moveType ] : structure.moves?.[ moveType ];
		if ( !moveDef ) {
			return yield* Effect.fail( new MoveNotAllowed( { move: String( moveType ) } ) );
		}

		const allowed = moveDef.canMove
			? yield* moveDef.canMove( readonly( data ), playerId )
			: data.context.currentPlayer === playerId;

		if ( !allowed ) {
			return yield* Effect.fail( new NotYourTurn( {
				playerId,
				currentPlayer: data.context.currentPlayer
			} ) );
		}

		yield* moveDef.validate( readonly( data ), playerId, input );

		let state = data.state;
		if ( phase?.hooks?.beforeMove ) {
			state = yield* phase.hooks.beforeMove(
				readonly( withState( data, state ) ),
				playerId,
				String( moveType )
			);
		}
		if ( structure.hooks?.beforeMove ) {
			state = yield* structure.hooks.beforeMove(
				readonly( withState( data, state ) ),
				playerId,
				String( moveType )
			);
		}

		state = yield* moveDef.execute( readonly( withState( data, state ) ), playerId, input );

		if ( structure.hooks?.afterMove ) {
			state = yield* structure.hooks.afterMove(
				readonly( withState( data, state ) ),
				playerId,
				String( moveType )
			);
		}
		if ( phase?.hooks?.afterMove ) {
			state = yield* phase.hooks.afterMove(
				readonly( withState( data, state ) ),
				playerId,
				String( moveType )
			);
		}

		let context = contextWith( data.context, { turn: data.context.turn + 1 } );
		let advanced = { ...data, state, context };

		if ( structure.phases && phase ) {
			const phaseEnded = yield* phase.endIf( readonly( advanced ) );
			if ( phaseEnded ) {
				const nextPhaseName = yield* phase.resolveNextPhase( readonly( advanced ) );
				const entered = yield* transitionToPhase( structure, advanced, phaseName, nextPhaseName );
				advanced = { ...advanced, state: entered.state, context: entered.context };
			} else {
				const next = yield* phase.resolveNextPlayer(
					readonly( advanced ),
					playerId,
					String( moveType )
				);
				context = contextWith( context, { currentPlayer: next } );
				advanced = { ...advanced, context };
			}
		} else if ( !structure.phases ) {
			const next = yield* structure.resolveNextPlayer(
				readonly( advanced ),
				playerId,
				String( moveType )
			);
			context = contextWith( context, { currentPlayer: next } );
			advanced = { ...advanced, context };
		}

		const ended = yield* structure.endIf( readonly( advanced ) );
		let finalState = advanced.state;
		let status = advanced.status;
		if ( ended ) {
			if ( structure.hooks?.onEnd ) {
				finalState =
					yield* structure.hooks.onEnd( readonly( advanced ) );
			}
			status = "COMPLETED";
		}

		const finalData = { ...advanced, state: finalState, status };
		yield* save( structure, finalData );

		if ( status === "COMPLETED" ) {
			yield* archive( structure, finalData );
		} else {
			yield* scheduleBotIfNeeded( finalData );
		}
	} )
		.pipe( Effect.withSpan(
			"engine.submitMove",
			{ attributes: { moveType: String( moveType ) } }
		) );

const getState = <
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	SV,
	PV,
	R = never
>(
	structure: GameStructure<State, Config, M, SV, PV, R>,
	playerInfo: PlayerInfo
) =>
	Effect.gen( function* () {
		const data = yield* load( structure );
		return yield* snapshot( structure, data, playerInfo.id );
	} ).pipe( Effect.withSpan( "engine.getState" ) );

const addBots = <
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	SV,
	PV,
	R = never
>( structure: GameStructure<State, Config, M, SV, PV, R> ) =>
	Effect.gen( function* () {
		const ids = yield* Ids;
		const data = yield* load( structure );
		const remaining = data.config.playerCount - Object.keys( data.players ).length;
		for ( let i = 0; i < remaining; i++ ) {
			const bot = yield* ids.botIdentity;
			yield* join(
				structure,
				new PlayerInfo( {
					id: PlayerId.make( bot.id ),
					name: bot.name,
					avatar: bot.avatar,
					isBot: true
				} )
			);
		}
	} ).pipe( Effect.withSpan( "engine.addBots" ) );

const cleanup = () =>
	Effect.gen( function* () {
		const scheduler = yield* Scheduler;
		const store = yield* GameStore;
		yield* scheduler.cancel;
		yield* store.clear;
	} ).pipe( Effect.withSpan( "engine.cleanup" ) );

/**
 * The Durable Object alarm entry point. Either fires a scheduled auto-start or
 * plays the current bot's move. Failures are swallowed — an alarm must not
 * throw back into the runtime.
 */
const runBotTurn = <
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	SV,
	PV,
	R = never
>( structure: GameStructure<State, Config, M, SV, PV, R> ) =>
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
 * lifecycle over the host services. `submitMove` is generic per move, so each
 * move's `input` keeps its exact decoded type. Games map these methods onto
 * their RPC group via `toLayer` (moves discard `submitMove`'s result — their
 * RPC returns `Void`; clients re-read via `getState`).
 */
export type Engine<
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	SV,
	PV,
	R = never
> = {
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
	readonly runBotTurn: () => Effect.Effect<void, never, EngineServices | R>;
	readonly cleanup: () => Effect.Effect<void, never, EngineServices | R>;
}

/**
 * Build the engine for a game. Accepts flat or phased structures; the returned
 * methods are the game-agnostic lifecycle plus a generic `submitMove`. Games
 * wire these onto their per-move RPCs in `toLayer`.
 */
export const makeEngine = <
	State,
	Config extends BaseGameConfig,
	M extends MoveMap<State, Config, R>,
	SV,
	PV,
	R = never
>(
	structure: GameStructure<State, Config, M, SV, PV, R>
): Engine<State, Config, M, SV, PV, R> => ( {
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
	runBotTurn: () => runBotTurn( structure ),
	cleanup: () => cleanup()
} );
