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
	PhaseNotFound,
	StaleCommand
} from "./errors.ts";
import {
	activeInteraction,
	CurrentPlayerSet,
	EngineEvent,
	EventsCommit,
	foldEvents,
	GameCompleted,
	InteractionResolved,
	InteractionResponded,
	isEngineEvent,
	nextSequentialResponder,
	PhaseEntered,
	PhaseExited,
	PlayerJoined,
	StatusChanged,
	TurnAdvanced
} from "./events.ts";
import {
	Audience,
	BaseGameConfig,
	CompletedGameData,
	GameContext,
	GameId,
	GameSnapshot,
	InitializeInput,
	InitializeResponse,
	InteractionFrame,
	JoinGameResponse,
	LogEntry,
	type MovePayload,
	PersistedGameData,
	playerAudience,
	PlayerId,
	PlayerInfo,
	tableAudience
} from "./schema.ts";
import { EventStore, GameArchive, GameStore, Scheduler, Sync } from "./services.ts";
import type { BaseMoveInputs, GameStructure } from "./structure.ts";

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
	View
>(
	structure: GameStructure<Name, State, Config, MoveInputs, PhaseMoves, Events, View>
) => {

	const GameEventsCommit = EventsCommit( structure.schemas.events );
	const PersistedData = PersistedGameData( structure.schemas.state, structure.schemas.config );
	const CompletedData = CompletedGameData( structure.schemas.views.view );
	const Snapshot = GameSnapshot( structure.schemas.views.view, structure.schemas.config );

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

	/**
	 * One handler per declared move, shaped like its RPC/HttpApi payload
	 * (`{ playerInfo, input }`) so a game can hand the whole engine to `toLayer`.
	 * Each key's `input` is typed to that move's own schema; move-name resolution
	 * (incl. the current phase) still happens inside `submitMove`. The mapped-type
	 * cast restores the precise per-move handler shape `Object.fromEntries` widens
	 * away, which `toLayer` needs to match the generated move RPCs.
	 */
	type MoveHandler<K extends keyof MoveInputs> = ( payload: MovePayload<MoveInputs[K]> ) =>
		ReturnType<typeof submitMove<K>>;

	type MoveHandlers = { [K in keyof MoveInputs]: MoveHandler<K>; };

	const moves = moveNames().reduce(
		( acc, name ) => {
			acc[ name ] = ( { playerInfo, input, ...rest } ) =>
				submitMove( name, input, playerInfo.id, rest );

			return acc;
		},
		{} as MoveHandlers
	);


	// --- Storage Helpers -------------------------------------------------------

	// #6: run persisted-state migrations on the RAW record before schema decode,
	// so a shape from before a `version` bump is repaired to the current shape.
	// Migrations are keyed by the version they upgrade FROM and applied in order.
	const migrateRaw = ( raw: unknown ): unknown => {
		if ( !structure.migrations ) {
			return raw;
		}
		const target = structure.version ?? 1;
		let record = raw as { version?: number };
		let version = typeof record.version === "number" ? record.version : 1;
		while ( version < target ) {
			const migrate = structure.migrations[ version ];
			if ( !migrate ) {
				break;
			}
			record = migrate( record ) as { version?: number };
			version += 1;
		}
		return record;
	};

	// #6: upcast a raw persisted commit's events before it is decoded, so old
	// event shapes in the append-only log still fold after an event-schema change.
	const upcastCommit = ( raw: unknown ): unknown => {
		if ( !structure.upcastEvent ) {
			return raw;
		}
		const commit = raw as { events?: ReadonlyArray<unknown> };
		return { ...commit, events: ( commit.events ?? [] ).map( structure.upcastEvent ) };
	};

	const load = () => Effect.gen( function* () {
		const store = yield* GameStore;
		const raw = yield* store.load();
		if ( Option.isNone( raw ) ) {
			return yield* new GameNotFound( { id: GameId.make( "unknown" ) } );
		}

		return yield* Schema.decodeUnknownEffect( PersistedData )( migrateRaw( raw.value ) ).pipe(
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

	/**
	 * While a SIMULTANEOUS reaction window is unresolved, other players' choices
	 * must not leak. Redact each simultaneous frame's `responses` to a boolean
	 * "responded" marker, revealing only the requesting player's own response
	 * (Table/spectator sees none). Sequential frames are public in order, so are
	 * left untouched.
	 */
	const redactInteractions = ( ctx: GameContext, audience: Audience ): GameContext => {
		if ( !ctx.interactions || ctx.interactions.length === 0 ) {
			return ctx;
		}

		const selfId = audience._tag === "swish/Player" ? audience.id : undefined;
		const interactions = ctx.interactions.map( ( frame ) => {
			if ( frame.mode !== "simultaneous" ) {
				return frame;
			}

			const responses: Record<PlayerId, unknown> = {};
			for ( const key of Object.keys( frame.responses ) ) {
				const pid = PlayerId.make( key );
				responses[ pid ] = pid === selfId ? frame.responses[ pid ] : true;
			}

			return InteractionFrame.make( {
				kind: frame.kind,
				initiator: frame.initiator,
				responders: frame.responders,
				mode: frame.mode,
				responses,
				target: frame.target,
				payload: frame.payload,
				deadline: frame.deadline
			} );
		} );

		return GameContext.make( {
			turn: ctx.turn,
			players: ctx.players,
			currentPlayer: ctx.currentPlayer,
			phase: ctx.phase,
			interactions,
			seats: ctx.seats
		} );
	};

	const snapshot = ( data: PersistedGameData<State, Config>, audience: Audience ) => {
		const view = structure.view( readonly( data, "view" ), audience );
		const { _tag, ...rest } = data;
		return Snapshot.make( {
			...rest,
			context: redactInteractions( rest.context, audience ),
			view
		} );
	};

	/**
	 * Push the fresh per-audience snapshots to connected clients (the same shapes
	 * `getState` returns — table + one per player, each redacted for its audience).
	 * Called after every commit; broadcast failures are swallowed so a delivery
	 * problem never fails the command that produced the state.
	 */
	const broadcastState = ( data: PersistedGameData<State, Config> ) =>
		Effect.gen( function* () {
			const sync = yield* Sync;
			const table = snapshot( data, tableAudience() );
			const playerViews: Record<PlayerId, unknown> = {};
			for ( const player of Object.values( data.players ) ) {
				playerViews[ player.id ] = snapshot( data, playerAudience( player.id ) );
			}
			yield* sync.broadcast( `${ structure.name }:${ data.id }`, { table, playerViews } );
		} ).pipe( Effect.ignore );

	// --- Event Sourcing Helpers ------------------------------------------------

	/**
	 * Persist one command: mint id + timestamp, encode the commit, append it to the
	 * log (dropping any redo tail), and save the new snapshot. The single commit
	 * point of a command.
	 */
	const commitAndSave = (
		work: PersistedGameData<State, Config>,
		meta: { command: string; actor?: PlayerId; moveType?: string; requestId?: string },
		events: ReadonlyArray<EngineEvent | Events>
	) =>
		Effect.gen( function* () {
			const log = yield* EventStore;

			const commit = GameEventsCommit.make( {
				id: generateId(),
				command: meta.command,
				actor: meta.actor,
				moveType: meta.moveType,
				requestId: meta.requestId,
				at: yield* Clock.currentTimeMillis,
				events
			} );

			yield* log.append( commit );
			yield* save( work );
			yield* broadcastState( work );
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

		let work = yield* Schema.decodeUnknownEffect( PersistedData )( migrateRaw( base ) )
			.pipe( Effect.mapError( corrupt ) );

		for ( const raw of commits.slice( 0, cursor + 1 ) ) {
			const commit = yield* Schema.decodeUnknownEffect( GameEventsCommit )( upcastCommit( raw ) )
				.pipe( Effect.mapError( corrupt ) );

			work = fold( work, commit.events );
		}

		return work;
	} );

	// --- Get Game State For Player ----------------------------------------------------

	const getState = ( audience: Audience ) => Effect.gen( function* () {
		const data = yield* load();
		return snapshot( data, audience );
	} );

	// #11: derive the action feed from the committed event log, mapping each
	// domain event through the game's `describe` (redacted per audience) and
	// stamping it with the commit's time/actor. Empty if the game has no describe.
	const getLog = ( audience: Audience ) => Effect.gen( function* () {
		const data = yield* load();
		const entries: Array<typeof LogEntry.Type> = [];
		if ( !structure.describe ) {
			return entries;
		}

		const log = yield* EventStore;
		const { commits, cursor } = yield* log.read;
		for ( const raw of commits.slice( 0, cursor + 1 ) ) {
			const commit = yield* Schema.decodeUnknownEffect( GameEventsCommit )( upcastCommit( raw ) )
				.pipe(
					Effect.mapError( ( issue ) => new CorruptState( {
						id: data.id,
						reason: String( issue )
					} ) )
				);

			for ( const ev of commit.events ) {
				if ( isEngineEvent( ev ) ) {
					continue;
				}

				const text = structure.describe( ev, data.players, data.config, audience );
				if ( text ) {
					entries.push( LogEntry.make( {
						at: commit.at,
						actor: commit.actor,
						kind: ev._tag,
						text
					} ) );
				}
			}
		}

		return entries;
	} );

	// --- lifecycle commands ----------------------------------------------------

	const initialize = ( payload: InitializeInput<Config> ) =>
		Effect.gen( function* () {
			const store = yield* GameStore;
			const log = yield* EventStore;

			const state = structure.setup( payload.config );
			const genesis = PersistedData.make( {
				version: structure.version ?? 1,
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
				"auto-start",
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

	/**
	 * The standard end-of-move tail: advance the turn, resolve the next player /
	 * phase transition, and finalize the game if it ended. Shared by a normal move
	 * and by an interaction stack draining back to normal flow. `fromData` supplies
	 * the phase the move/interaction was made in.
	 */
	const advanceTail = (
		acc: Acc,
		actorId: PlayerId,
		move: string,
		fromData: PersistedGameData<State, Config>,
		advance = true
	) => Effect.gen( function* () {
		// `advance` is false for a move with `endsTurn: false` — keep the current
		// player and don't transition, but still evaluate game completion below.
		if ( advance ) {
			emit( acc, [ TurnAdvanced.make( {} ) ] );

			if ( structure.phases ) {
				const phaseName = String( fromData.context.phase ?? structure.initialPhase );
				const phase = structure.phases[ phaseName ];
				const phaseEnded = phase.endIf( readonly( acc.work ) );

				if ( phaseEnded ) {
					const nextPhaseName = phase.resolveNextPhase( readonly( acc.work ) );
					if ( phase.onExit ) {
						emit( acc, phase.onExit( readonly( acc.work, "onExit" ) ) );
					}

					emit( acc, [ PhaseExited.make( { phase: phaseName } ) ] );

					const entered = yield* enterPhase( acc.work, nextPhaseName );
					acc.events.push( ...entered.events );
					acc.work = entered.work;

				} else if ( phase.resolveNextPlayer ) {
					const next = phase.resolveNextPlayer( readonly( acc.work ), actorId, move );
					emit( acc, [ CurrentPlayerSet.make( { playerId: next } ) ] );
				}
			} else if ( structure.resolveNextPlayer ) {
				const next = structure.resolveNextPlayer( readonly( acc.work ), actorId, move );
				emit( acc, [ CurrentPlayerSet.make( { playerId: next } ) ] );
			}
		}

		const ended = structure.endIf( readonly( acc.work ) );
		if ( ended ) {
			if ( structure.hooks?.onEnd ) {
				emit( acc, structure.hooks.onEnd( readonly( acc.work, "onEnd" ) ) );
			}

			emit( acc, [ GameCompleted.make( {} ) ] );
		}
	} );

	/**
	 * Resolve as many completed interaction frames as possible. Popping the
	 * completed top BEFORE running `resolve` means a nested `openInteraction`
	 * emitted by `resolve` pushes a fresh (incomplete) frame, so the loop halts
	 * awaiting its responses instead of spinning.
	 */
	const runResolveLoop = ( acc: Acc ) => Effect.gen( function* () {
		while ( true ) {
			const top = activeInteraction( acc.work.context );
			if ( !top ) {
				break;
			}

			const def = structure.interactions?.[ top.kind ];
			if ( !def ) {
				break;
			}

			const complete = def.isComplete
				? def.isComplete( readonly( acc.work ), top )
				: top.responders.every( ( id ) => id in top.responses );

			if ( !complete ) {
				break;
			}

			const resolveEvents = def.resolve( readonly( acc.work, "resolve" ), top );
			emit( acc, [ InteractionResolved.make( {} ) ] );
			emit( acc, resolveEvents );
		}
	} );

	const submitMove = <MoveType extends keyof MoveInputs>(
		moveType: MoveType,
		input: MoveInputs[MoveType]["Type"],
		playerId: PlayerId,
		opts?: { readonly requestId?: string; readonly expectedTurn?: number }
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

		// #8: config-driven capability gate — a variant/house-rule may disable a move.
		if ( moveDef.enabledWhen && !moveDef.enabledWhen( data.config ) ) {
			return yield* new MoveNotAllowed( { move } );
		}

		// #13: optimistic concurrency — reject a move made against a stale turn.
		if ( opts?.expectedTurn !== undefined && opts.expectedTurn !== data.context.turn ) {
			return yield* new StaleCommand( { expected: opts.expectedTurn, actual: data.context.turn } );
		}

		// #13: idempotency — if this requestId was already committed, no-op. The DO
		// serializes writes, so a scan of the append-only log is race-free.
		if ( opts?.requestId ) {
			const log = yield* EventStore;
			const { commits } = yield* log.read;
			const seen = commits.some(
				( c ) => ( c as { requestId?: string } | null )?.requestId === opts.requestId
			);
			if ( seen ) {
				return;
			}
		}

		const acc: Acc = { events: [], work: data };
		const active = activeInteraction( data.context );

		if ( active ) {
			// --- interaction response branch -----------------------------------
			// A window is open: route to its responders, not `currentPlayer`, and
			// suppress turn advancement until the whole stack resolves.
			const idef = structure.interactions?.[ active.kind ];
			if ( !idef || !idef.responseMoves.includes( moveType ) ) {
				return yield* new MoveNotAllowed( { move } );
			}

			const allowed = idef.canRespond
				? idef.canRespond( readonly( data ), active, playerId )
				: active.mode === "sequential"
					? nextSequentialResponder( active ) === playerId
					: active.responders.includes( playerId ) && !( playerId in active.responses );

			if ( !allowed ) {
				return yield* new NotYourTurn( { playerId, currentPlayer: data.context.currentPlayer } );
			}

			const error = moveDef.validate( readonly( data ), playerId, input );
			if ( error ) {
				return yield* error;
			}

			emit( acc, [ InteractionResponded.make( { playerId, response: input } ) ] );
			emit( acc, moveDef.execute( readonly( acc.work, "execute" ), playerId, input ) );

			yield* runResolveLoop( acc );

			// The whole stack drained → resume normal flow from the original actor
			// (the bottom frame's initiator = the move that opened the window).
			if ( !activeInteraction( acc.work.context ) ) {
				const originalActor = data.context.interactions?.[ 0 ]?.initiator ?? playerId;
				yield* advanceTail( acc, originalActor, move, data );
			}
		} else {
			// --- normal move branch --------------------------------------------
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
			if ( structure.hooks?.beforeMove ) {
				emit(
					acc,
					structure.hooks.beforeMove( readonly( acc.work, "beforeMove" ), playerId, move )
				);
			}

			emit( acc, moveDef.execute( readonly( acc.work, "execute" ), playerId, input ) );

			if ( structure.hooks?.afterMove ) {
				emit( acc, structure.hooks.afterMove( readonly( acc.work, "afterMove" ), playerId, move ) );
			}

			// If the move opened a reaction window, DO NOT advance the turn — wait
			// for responses. Otherwise run the standard tail, advancing the turn
			// only when the move ends it (`endsTurn`, default true).
			if ( !activeInteraction( acc.work.context ) ) {
				const endsTurn = typeof moveDef.endsTurn === "function"
					? moveDef.endsTurn( readonly( acc.work ), playerId, input )
					: moveDef.endsTurn ?? true;

				yield* advanceTail( acc, playerId, move, data, endsTurn );
			}
		}

		yield* commitAndSave(
			acc.work,
			{ command: "submitMove", actor: playerId, moveType: move, requestId: opts?.requestId },
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
			yield* broadcastState( work );

			return snapshot( work, playerAudience( playerInfo.id ) );
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
			yield* broadcastState( work );

			return snapshot( work, playerAudience( playerInfo.id ) );
		} );

	const reconcile = ( work: PersistedGameData<State, Config> ) =>
		Effect.gen( function* () {
			const scheduler = yield* Scheduler;
			yield* scheduler.cancelAll;
			yield* scheduleBotIfNeeded( work );
		} );

	/**
	 * Whose turn it is to act: while a reaction window is open, the pending
	 * responder (the next sequential responder, or any simultaneous responder who
	 * still owes an answer); otherwise the normal `currentPlayer`.
	 */
	const whoBotShouldAct = ( data: PersistedGameData<State, Config> ): PlayerId | undefined => {
		const active = activeInteraction( data.context );
		if ( active ) {
			return active.mode === "sequential"
				? nextSequentialResponder( active )
				: active.responders.find( ( id ) => !( id in active.responses ) );
		}

		return data.context.currentPlayer;
	};

	const scheduleBotIfNeeded = ( data: PersistedGameData<State, Config> ) =>
		Effect.gen( function* () {
			const scheduler = yield* Scheduler;
			if ( data.status !== "IN_PROGRESS" ) {
				return;
			}

			const actorId = whoBotShouldAct( data );
			const actor = actorId ? data.players[ actorId ] : undefined;
			if ( actor?.isBot ) {
				yield* scheduler.schedule( "bot", BOT_DELAY_MS, "bot" );
			}
		} );

	// --- Cleanup & Archive ----------------------------------------------------

	const cleanup = Effect.gen( function* () {
		const scheduler = yield* Scheduler;
		const store = yield* GameStore;
		yield* scheduler.cancelAll;
		yield* store.clear();
	} );

	const archive = ( data: PersistedGameData<State, Config> ) => Effect.gen( function* () {
		const arch = yield* GameArchive;
		const rd = readonly( data, "view" );
		const table = structure.view( rd, tableAudience() );

		const playerViews: Record<PlayerId, View> = {};
		for ( const player of Object.values( data.players ) ) {
			playerViews[ player.id ] = structure.view( rd, playerAudience( player.id ) );
		}

		const results = structure.resolveResults ? structure.resolveResults( rd ) : undefined;

		const completed = CompletedData.make( {
			id: data.id,
			code: data.code,
			status: data.status,
			context: data.context,
			players: data.players,
			table,
			playerViews,
			results
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
		// Collect every timer now due (multiple may coincide) and re-arm the host.
		const due = yield* scheduler.due;
		if ( due.length === 0 ) {
			return;
		}

		if ( due.includes( "auto-start" ) ) {
			yield* start().pipe(
				Effect.catchCause( ( cause ) => Effect.logError(
					"engine.runBotTurn: auto-start failed",
					cause
				) )
			);
			return;
		}

		// A bot delay or a reaction timeout: play the pending actor's bot move.
		// (`move-timeout` handling is left for games that opt into a turn clock.)
		if ( !due.includes( "bot" ) && !due.includes( "interaction-timeout" ) ) {
			return;
		}

		const data = yield* load().pipe( Effect.catch( () => Effect.succeed( null ) ) );
		if ( !data || data.status !== "IN_PROGRESS" ) {
			return;
		}

		// The player to act may be a reaction responder, not `currentPlayer`.
		const actorId = whoBotShouldAct( data );
		const current = actorId ? data.players[ actorId ] : undefined;
		if ( !current?.isBot ) {
			return;
		}

		if ( !structure.botMove ) {
			return;
		}

		const move = structure.botMove( snapshot( data, playerAudience( current.id ) ) );
		if ( !move ) {
			return;
		}

		yield* submitMove( move.moveType, move.input, current.id ).pipe(
			Effect.catchCause( ( cause ) => Effect.logError(
				"engine.runBotTurn: bot move failed",
				cause
			) )
		);
	} );

	return {
		getState,
		getLog,
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

