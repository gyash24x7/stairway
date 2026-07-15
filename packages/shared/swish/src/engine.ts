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

import { generateBotInfo, generateId } from "@s2h/utils/generator";
import { hashSeed, makeRng } from "@s2h/utils/rng";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
	CannotStart,
	CorruptState,
	GameFull,
	GameNotFound,
	GameNotInProgress,
	MoveNotAllowed,
	NothingToRedo,
	NothingToUndo,
	NotYourTurn,
	PhaseNotFound
} from "./errors";
import {
	CurrentPlayerSet,
	EngineEvent,
	EventsCommit,
	foldEvents,
	GameCompleted,
	PhaseEntered,
	PhaseExited,
	PlayerJoined,
	StatusChanged,
	TurnAdvanced
} from "./events";
import {
	BaseGameConfig,
	CompletedGameData,
	GameContext,
	GameId,
	GameSnapshot,
	InitializeInput,
	InitializeResponse,
	JoinGameResponse,
	PersistedGameData,
	PlayerId,
	PlayerInfo
} from "./schema";
import { EventStore, GameArchive, GameStore, Scheduler } from "./services";
import type { BaseMoveInputs, GameStructure } from "./structure";

const BOT_DELAY_MS = 5000;
const AUTO_START_DELAY_MS = 5000;

/**
 * Build the engine for a game. Accepts flat or phased structures; the returned
 * methods are the game-agnostic lifecycle plus a generic `submitMove` and the
 * additive `undo`/`redo`. Games wire these onto their RPCs in `toLayer`.
 */
export const makeEngine = <
	Name extends string,
	State,
	Config extends BaseGameConfig,
	MoveInputs extends BaseMoveInputs,
	PhaseMoves extends Record<string, ReadonlyArray<keyof MoveInputs>>,
	Events extends { readonly _tag: string },
	SharedView,
	PlayerView
>(
	structure: GameStructure<Name, State, Config, MoveInputs, PhaseMoves, Events, SharedView, PlayerView>
) => {

	const GameEventsCommit = EventsCommit( structure.schemas.events );
	const PersistedData = PersistedGameData( structure.schemas.state, structure.schemas.config );
	const CompletedData = CompletedGameData(
		structure.schemas.views.shared,
		structure.schemas.views.player
	);

	const Snapshot = GameSnapshot(
		structure.schemas.views.shared,
		structure.schemas.views.player,
		structure.schemas.config
	);

	interface Acc {
		events: Array<EngineEvent | Events>;
		work: PersistedGameData<State, Config>;
	}

	const readonly = ( data: PersistedGameData<State, Config>, role = "" ) => ( {
		state: data.state,
		config: data.config,
		context: data.context,
		// A deterministic PRNG seeded by the server-only seed + turn + decider
		// role (+ optional caller salt). The role keeps same-turn deciders
		// (beforeMove/execute/afterMove/onEnter/…) from sharing a stream.
		rng: ( salt = "" ) => makeRng( hashSeed( data.seed ?? "", data.context.turn, role, salt ) )
	} );

	/**
	 * Every declared move name. In the new structure all moves — flat or phased —
	 * live in the top-level `moves` map (a phased move just tags itself with its
	 * `phase`); `phases[k].moves` is only a name list for enumeration/validation.
	 */
	const moveNames = (): Array<keyof MoveInputs> =>
		Object.keys( structure.moves ?? {} ).map( move => move as keyof MoveInputs );

	type MovePayload<K extends keyof MoveInputs> = {
		readonly playerInfo: PlayerInfo;
		readonly input: MoveInputs[ K ][ "Type" ];
	}

	/**
	 * One handler per declared move, shaped like its RPC/HttpApi payload
	 * (`{ playerInfo, input }`) so a game can hand the whole engine to `toLayer`.
	 * Each key's `input` is typed to that move's own schema; move-name resolution
	 * (incl. the current phase) still happens inside `submitMove`.
	 */
	type MoveHandlers = {
		readonly [K in keyof MoveInputs]: ( payload: MovePayload<K> ) => ReturnType<typeof submitMove<K>>;
	};

	const moves = Object.fromEntries(
		moveNames().map( ( name ) => [
			name,
			( { playerInfo, input }: {
				playerInfo: PlayerInfo;
				input: MoveInputs[typeof name]["Type"]
			} ) => submitMove( name, input, playerInfo.id )
		] )
	) as MoveHandlers;


	// --- Storage Helpers -------------------------------------------------------

	const load = () => Effect.gen( function* () {
		const store = yield* GameStore;
		const raw = yield* store.load();
		if ( Option.isNone( raw ) ) {
			return yield* new GameNotFound( { id: GameId.make( "unknown" ) } );
		}

		return yield* Schema.decodeUnknownEffect( PersistedData )( raw.value ).pipe(
			Effect.mapError( ( issue ) => new CorruptState( {
				id: GameId.make( "unknown" ),
				reason: String( issue )
			} ) )
		);
	} );

	const save = ( data: PersistedGameData<State, Config> ) =>
		Effect.gen( function* () {
			const store = yield* GameStore;
			yield* store.save( data );
		} );

	const snapshot = ( data: PersistedGameData<State, Config>, playerId: PlayerId ) => {
		const rd = readonly( data );
		const shared = structure.sharedView( rd );
		const player = structure.playerView( rd, playerId );
		const { _tag, ...rest } = data;
		return Snapshot.make( { ...rest, shared, player } );
	};

	// --- Event Sourcing Helpers ------------------------------------------------

	/**
	 * Persist one command: mint id + timestamp, encode the commit, append it to the
	 * log (dropping any redo tail), and save the new snapshot. The single commit
	 * point of a command.
	 */
	const commitAndSave = (
		work: PersistedGameData<State, Config>,
		meta: { command: string; actor?: PlayerId; moveType?: string },
		events: ReadonlyArray<EngineEvent | Events>
	) =>
		Effect.gen( function* () {
			const log = yield* EventStore;

			const commit = GameEventsCommit.make( {
				id: generateId(),
				command: meta.command,
				actor: meta.actor,
				moveType: meta.moveType,
				at: yield* Clock.currentTimeMillis,
				events
			} );

			yield* log.append( commit );
			yield* save( work );
		} );

	const emit = ( acc: Acc, es: ReadonlyArray<EngineEvent | Events> ) => {
		acc.events.push( ...es );
		acc.work = fold( acc.work, es );
		return acc;
	};

	/** Enter a phase: emit PhaseEntered, run `onEnter`, set the starting player. */
	const enterPhase = ( from: PersistedGameData<State, Config>, phaseName: keyof PhaseMoves ) =>
		Effect.gen( function* () {
			const phase = structure.phases?.[ phaseName ];
			if ( !phase ) {
				return yield* new PhaseNotFound( { phase: String( phaseName ) } );
			}

			const acc: Acc = { events: [], work: from };
			emit( acc, [ PhaseEntered.make( { phase: String( phaseName ) } ) ] );

			if ( phase.onEnter ) {
				emit( acc, phase.onEnter( readonly( acc.work, "onEnter" ) ) );
			}

			if ( phase.resolveStartingPlayer ) {
				const starting = phase.resolveStartingPlayer( readonly( acc.work, "startingPlayer" ) );
				emit( acc, [ CurrentPlayerSet.make( { playerId: starting } ) ] );
			}

			return acc;
		} );

	/** Fold events onto a record via the game's `apply` (the only state-changer). */
	const fold = (
		data: PersistedGameData<State, Config>,
		events: ReadonlyArray<EngineEvent | Events>
	) => foldEvents( structure.apply, data, events );

	/** Refold the current state from the log's genesis up to the cursor. */
	const refold = () => Effect.gen( function* () {
		const log = yield* EventStore;
		const { base, commits, cursor } = yield* log.read;
		const corrupt = ( issue: unknown ) => new CorruptState( {
			id: GameId.make( "unknown" ),
			reason: String( issue )
		} );

		let work = yield* Schema.decodeUnknownEffect( PersistedData )( base )
			.pipe( Effect.mapError( corrupt ) );

		for ( const raw of commits.slice( 0, cursor + 1 ) ) {
			const commit = yield* Schema.decodeUnknownEffect( GameEventsCommit )( raw )
				.pipe( Effect.mapError( corrupt ) );

			work = fold( work, commit.events );
		}

		return work;
	} );

	// --- Get Game State For Player ----------------------------------------------------

	const getState = ( playerInfo: PlayerInfo ) => Effect.gen( function* () {
		const data = yield* load();
		return snapshot( data, playerInfo.id );
	} );

	// --- lifecycle commands ----------------------------------------------------

	const initialize = ( payload: InitializeInput<Config> ) =>
		Effect.gen( function* () {
			const store = yield* GameStore;
			const log = yield* EventStore;

			const state = structure.setup( payload.config );
			const genesis = PersistedData.make( {
				version: 1,
				seed: payload.seed ?? generateId(),
				id: payload.id,
				code: payload.code,
				status: "CREATED",
				context: GameContext.make( { turn: 0, players: [], currentPlayer: PlayerId.make( "" ) } ),
				players: {},
				config: payload.config,
				state
			} );

			yield* log.setBase( genesis );
			yield* store.save( genesis );

			return InitializeResponse.make( { id: payload.id } );
		} );

	const join = ( playerInfo: PlayerInfo ) => Effect.gen( function* () {
		const scheduler = yield* Scheduler;
		const data = yield* load();
		if ( data.players[ playerInfo.id ] ) {
			return JoinGameResponse.make( { id: data.id, code: data.code } );
		}

		if ( Object.keys( data.players ).length >= data.config.playerCount ) {
			return yield* new GameFull( { playerCount: data.config.playerCount } );
		}

		const acc: Acc = { events: [], work: data };
		if ( structure.hooks?.onJoin ) {
			emit( acc, structure.hooks.onJoin(
				readonly( acc.work, "onJoin" ),
				playerInfo.id
			) );
		}

		emit( acc, [ PlayerJoined.make( { player: playerInfo } ) ] );

		const nowFull = Object.keys( acc.work.players ).length >= acc.work.config.playerCount;
		if ( nowFull &&
			!acc.work.config.autoStart ) {
			emit( acc, [ StatusChanged.make( { status: "PLAYERS_READY" } ) ] );
		}

		yield* commitAndSave( acc.work, { command: "join", actor: playerInfo.id }, acc.events );
		if ( nowFull && acc.work.config.autoStart ) {
			yield* scheduler.schedule(
				AUTO_START_DELAY_MS,
				"auto-start"
			);
		}

		return JoinGameResponse.make( { id: data.id, code: data.code } );
	} );

	const addBots = () => Effect.gen( function* () {
		const data = yield* load();
		const remaining = data.config.playerCount - Object.keys( data.players ).length;
		for ( let i = 0; i < remaining; i++ ) {
			const bot = generateBotInfo();
			yield* join(
				PlayerInfo.make( {
					id: PlayerId.make( bot.id ),
					name: bot.name,
					avatar: bot.avatar,
					isBot: true
				} )
			);
		}
	} );

	const start = () => Effect.gen( function* () {
		const data = yield* load();
		const count = Object.keys( data.players ).length;
		const cannotStart = data.status === "IN_PROGRESS"
			|| data.status === "COMPLETED"
			|| count < data.config.playerCount;

		if ( cannotStart ) {
			return yield* new CannotStart( { status: data.status } );
		}

		const acc: Acc = { events: [], work: data };
		if ( structure.hooks?.onStart ) {
			emit( acc, structure.hooks.onStart( readonly( acc.work, "onStart" ) ) );
		}

		if ( structure.phases && structure.initialPhase ) {
			const entered = yield* enterPhase( acc.work, structure.initialPhase );
			acc.events.push( ...entered.events );
			acc.work = entered.work;
		}

		emit( acc, [ StatusChanged.make( { status: "IN_PROGRESS" } ) ] );

		yield* commitAndSave( acc.work, { command: "start" }, acc.events );
		yield* scheduleBotIfNeeded( acc.work );
	} );

	const submitMove = <MoveType extends keyof MoveInputs>(
		moveType: MoveType,
		input: MoveInputs[MoveType]["Type"],
		playerId: PlayerId
	) => Effect.gen( function* () {

		const move = String( moveType );
		const data = yield* load();

		if ( data.status !== "IN_PROGRESS" ) {
			return yield* new GameNotInProgress( { status: data.status } );
		}

		const moveDef = structure.moves[ moveType ];
		if ( !moveDef ) {
			return yield* new MoveNotAllowed( { move } );
		}

		if ( structure.phases && structure.initialPhase ) {

			const phase = String( data.context.phase ?? structure.initialPhase );
			if ( !structure.phases[ phase ] ) {
				return yield* new PhaseNotFound( { phase } );
			}

			if ( moveDef.phase !== phase ) {
				return yield* new MoveNotAllowed( { move } );
			}
		}

		const allowed = moveDef.canMove
			? moveDef.canMove( readonly( data ), playerId )
			: data.context.currentPlayer === playerId;

		if ( !allowed ) {
			return yield* new NotYourTurn( { playerId, currentPlayer: data.context.currentPlayer } );
		}

		const error = moveDef.validate( readonly( data ), playerId, input );
		if ( error ) {
			return yield* error;
		}

		// decide — emit events, fold onto the working copy as we go
		const acc: Acc = { events: [], work: data };

		if ( structure.hooks?.beforeMove ) {
			emit( acc, structure.hooks.beforeMove( readonly( acc.work, "beforeMove" ), playerId, move ) );
		}

		emit( acc, moveDef.execute( readonly( acc.work, "execute" ), playerId, input ) );

		if ( structure.hooks?.afterMove ) {
			emit( acc, structure.hooks.afterMove( readonly( acc.work, "afterMove" ), playerId, move ) );
		}

		emit( acc, [ TurnAdvanced.make( {} ) ] );

		if ( structure.phases ) {
			const phaseName = String( data.context.phase ?? structure.initialPhase );
			const phase = structure.phases[ phaseName ];
			const phaseEnded = phase.endIf( readonly( acc.work ) );

			if ( phaseEnded ) {
				const nextPhaseName = phase.resolveNextPhase( readonly( acc.work ) );
				if ( phase.onExit ) {
					emit( acc, phase.onExit( readonly( acc.work, "onExit" ) ) );
				}

				emit( acc, [ PhaseExited.make( { phase: String( phaseName ) ?? "" } ) ] );

				const entered = yield* enterPhase( acc.work, nextPhaseName );
				acc.events.push( ...entered.events );
				acc.work = entered.work;

			} else if ( phase.resolveNextPlayer ) {
				const next = phase.resolveNextPlayer( readonly( acc.work ), playerId, move );
				emit( acc, [ CurrentPlayerSet.make( { playerId: next } ) ] );
			}
		} else if ( structure.resolveNextPlayer ) {
			const next = structure.resolveNextPlayer( readonly( acc.work ), playerId, move );
			emit( acc, [ CurrentPlayerSet.make( { playerId: next } ) ] );
		}

		const ended = structure.endIf( readonly( acc.work ) );
		if ( ended ) {
			if ( structure.hooks?.onEnd ) {
				emit( acc, structure.hooks.onEnd( readonly( acc.work, "onEnd" ) ) );
			}

			emit( acc, [ GameCompleted.make( {} ) ] );
		}

		yield* commitAndSave(
			acc.work,
			{ command: "submitMove", actor: playerId, moveType: move },
			acc.events
		);

		if ( acc.work.status === "COMPLETED" ) {
			yield* archive( acc.work );
		} else {
			yield* scheduleBotIfNeeded( acc.work );
		}
	} );

	// --- Undo / Redo ----------------------------------------------------

	const undo = ( playerInfo: PlayerInfo ) =>
		Effect.gen( function* () {
			const log = yield* EventStore;

			const moved = yield* log.moveCursor( -1 );
			if ( Option.isNone( moved ) ) {
				return yield* new NothingToUndo();
			}

			const work = yield* refold();
			yield* save( work );
			yield* reconcile( work );

			return snapshot( work, playerInfo.id );
		} );

	const redo = ( playerInfo: PlayerInfo ) =>
		Effect.gen( function* () {
			const log = yield* EventStore;

			const moved = yield* log.moveCursor( 1 );
			if ( Option.isNone( moved ) ) {
				return yield* new NothingToRedo();
			}

			const work = yield* refold();
			yield* save( work );
			yield* reconcile( work );

			return snapshot( work, playerInfo.id );
		} );

	const reconcile = ( work: PersistedGameData<State, Config> ) =>
		Effect.gen( function* () {
			const scheduler = yield* Scheduler;
			yield* scheduler.cancel;
			yield* scheduleBotIfNeeded( work );
		} );

	const scheduleBotIfNeeded = ( data: PersistedGameData<State, Config> ) =>
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

	// --- Cleanup & Archive ----------------------------------------------------

	const cleanup = Effect.gen( function* () {
		const scheduler = yield* Scheduler;
		const store = yield* GameStore;
		yield* scheduler.cancel;
		yield* store.clear();
	} );

	const archive = ( data: PersistedGameData<State, Config> ) => Effect.gen( function* () {
		const arch = yield* GameArchive;
		const rd = readonly( data );
		const shared = structure.sharedView( rd );

		const playerViews: Record<PlayerId, PlayerView> = {};
		for ( const player of Object.values( data.players ) ) {
			playerViews[ player.id ] = structure.playerView( rd, player.id );
		}

		const completed = CompletedData.make( {
			id: data.id,
			code: data.code,
			status: data.status,
			context: data.context,
			players: data.players,
			shared,
			playerViews
		} );

		yield* arch.put( `${ structure.name }:${ data.id }`, completed );
	} );

	/**
	 * The Durable Object alarm entry point. Fires a scheduled auto-start or plays
	 * the current bot's move. Failures are logged, not thrown (an alarm must not
	 * throw back into the runtime).
	 */
	const runBotTurn = Effect.gen( function* () {
		const scheduler = yield* Scheduler;
		const kind = yield* scheduler.read;
		if ( Option.isSome( kind ) && kind.value === "auto-start" ) {
			yield* start().pipe(
				Effect.catchCause( ( cause ) => Effect.logError(
					"engine.runBotTurn: auto-start failed",
					cause
				) )
			);
			return;
		}

		const data = yield* load().pipe( Effect.catch( () => Effect.succeed( null ) ) );
		if ( !data || data.status !== "IN_PROGRESS" ) {
			return;
		}

		const current = data.players[ data.context.currentPlayer ];
		if ( !current?.isBot ) {
			return;
		}

		if ( !structure.botMove ) {
			return;
		}

		const move = structure.botMove( snapshot( data, current.id ) );
		yield* submitMove( move.moveType, move.input, current.id ).pipe(
			Effect.catchCause( ( cause ) => Effect.logError(
				"engine.runBotTurn: bot move failed",
				cause
			) )
		);
	} );

	return {
		getState,
		initialize,
		join,
		addBots,
		start,
		submitMove,
		undo,
		redo,
		cleanup,
		runBotTurn,
		...moves
	};
};

