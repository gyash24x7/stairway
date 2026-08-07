import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { hashSeed, makeRng } from "@/shared/utils/rng.ts";
import {
	type CommitMeta,
	GameContext,
	GameId,
	GameSnapshot,
	InitializeResponse,
	InteractionFrame,
	JoinGameResponse,
	LogEntry,
	PersistedGameData,
	playerAudience,
	PlayerId,
	PlayerInfo,
	tableAudience
} from "@/shared/swish/schema.ts";
import type { Audience, BaseGameConfig, InitializeInput } from "@/shared/swish/schema.ts";
import { generateBotInfo, generateId } from "@/shared/utils/generator.ts";
import {
	CannotStart,
	CorruptState,
	GameFull,
	GameNotFound,
	GameNotInProgress,
	MoveNotAllowed,
	NotAMember,
	NothingToRedo,
	NothingToUndo,
	NotYourTurn,
	PhaseNotFound
} from "@/shared/swish/errors.ts";
import type { EngineEvent } from "@/shared/swish/events.ts";
import {
	activeInteraction,
	CurrentPlayerSet,
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
} from "@/shared/swish/events.ts";
import { EventStore, GameStore, Scheduler, Sync } from "@/shared/swish/services.ts";
import type { BaseMoveInputs, GameStructure } from "@/shared/swish/structure.ts";

const BOT_DELAY_MS = 5000;
const AUTO_START_DELAY_MS = 5000;

/**
 * Builds the game-agnostic engine for a game from its declarative structure.
 * Accepts flat or phased structures; the returned object is the lifecycle
 * (`initialize`/`join`/`addBots`/`start`), read models (`getState`/`getLog`), the
 * generic `submitMove`, additive `undo`/`redo`, `cleanup`/`archive`, the alarm
 * entry point `runBotTurn`, and one typed handler per declared move. Games wire
 * these onto their RPCs/HttpApi in `toLayer`.
 *
 * @param structure - The game's schemas, rules, views, hooks, and bot policy.
 * @returns An effect that resolved the engine methods plus a handler per move.
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
) => Effect.gen( function* () {

	const scheduler = yield* Scheduler;
	const store = yield* GameStore;
	const sync = yield* Sync;
	const log = yield* EventStore;

	const GameEventsCommit = EventsCommit( structure.schemas.events );
	const PersistedData = PersistedGameData( structure.schemas.state, structure.schemas.config );
	const Snapshot = GameSnapshot( structure.schemas.view, structure.schemas.config );

	interface Acc {
		events: Array<EngineEvent | Events>;
		work: PersistedGameData<State, Config>;
	}

	/**
	 * Wraps a persisted record as the `ReadonlyGameData` passed into every game
	 * function. The `rng` factory folds the game seed, the current turn, the
	 * caller's `role`, and an optional `salt` into a deterministic stream, so
	 * distinct call sites in the same turn never share a sequence.
	 *
	 * @param data - The record to expose read-only.
	 * @param [role] - A label for the call site, salting its rng stream (e.g. "execute", "view").
	 * @returns The read-only snapshot (`state`, `config`, `context`, `rng`).
	 */
	const readonly = ( data: PersistedGameData<State, Config>, role: string = "" ) => ( {
		state: data.state,
		config: data.config,
		context: data.context,
		rng: ( salt = "" ) => makeRng( hashSeed( data.seed ?? "", data.context.turn, role, salt ) )
	} );

	/**
	 * Every declared move name. In the new structure all moves — flat or phased —
	 * live in the top-level `moves` map (a phased move just tags itself with its
	 * `phase`); `phases[k].moves` is only a name list for enumeration/validation.
	 */
	const moveNames = () => Object.keys( structure.moves ?? {} )
		.map( move => move as keyof MoveInputs );

	/**
	 * One handler per declared move, shaped like its RPC/HttpApi payload
	 * (the move's own `input`) so a game can hand the whole engine to `toLayer`.
	 * Each key's `input` is typed to that move's own schema; move-name resolution
	 * (incl. the current phase) still happens inside `submitMove`. The mapped-type
	 * cast restores the precise per-move handler shape `Object.fromEntries` widens
	 * away, which `toLayer` needs to match the generated move RPCs.
	 */
	type MoveHandler<K extends keyof MoveInputs> = (
		input: MoveInputs[K][ "Type" ],
		playerInfo: PlayerInfo
	) => ReturnType<typeof submitMove<K>>;

	type MoveHandlers = { [K in keyof MoveInputs]: MoveHandler<K>; };

	const moves = moveNames().reduce(
		( acc, name ) => {
			acc[ name ] = ( input, playerInfo ) => submitMove( name, input, playerInfo );
			return acc;
		},
		{} as MoveHandlers
	);


	// --- Storage Helpers -------------------------------------------------------

	/**
	 * Loads and decodes the current persisted snapshot from `GameStore`.
	 *
	 * @returns The decoded record, failing with `GameNotFound` when absent or `CorruptState`
	 * when it no longer decodes against the game's schema.
	 */
	const load = Effect.fn( function* () {
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

	/**
	 * Persists the snapshot (the fold cache) to `GameStore`. The append-only log
	 * remains the source of truth; this snapshot is what `load` reads back.
	 *
	 * @param data - The record to persist.
	 * @returns Completes once the snapshot is saved.
	 */
	const save = Effect.fn( function* ( data: PersistedGameData<State, Config> ) {
		yield* store.save( data );
	} );

	/**
	 * Asserts the caller is a seated player in this game. Every command except
	 * `initialize`/`join` runs this against the authenticated identity, so a
	 * non-member can neither read a private view nor act on a game they never
	 * joined. Takes already-loaded `data` so callers don't re-read the store.
	 *
	 * @param data - The loaded record whose roster to check.
	 * @param userId - The authenticated caller's id.
	 * @returns Void, or fails with `NotAMember` when the id holds no seat.
	 */
	const assertMember = ( data: PersistedGameData<State, Config>, userId: PlayerId ) =>
		data.players[ userId ]
			? Effect.void
			: Effect.fail( new NotAMember( { playerId: userId } ) );

	/**
	 * Redacts the interaction stack for one audience so an unresolved SIMULTANEOUS
	 * window does not leak other players' in-flight choices. Each simultaneous
	 * frame's `responses` collapse to a boolean "responded" marker, revealing only
	 * the requesting player's own response (a Table/spectator audience sees none).
	 * Sequential frames are public in order and pass through untouched.
	 *
	 * @param ctx - The context whose interaction stack to redact.
	 * @param audience - Who the view is for (a `Player` sees their own response).
	 * @returns The context with simultaneous responses redacted (or `ctx` unchanged
	 * when no window is open).
	 */
	const redactInteractions = ( ctx: GameContext, audience: Audience ) => {
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

	/**
	 * Projects a persisted record into the client-facing `GameSnapshot` for one
	 * audience: the game's audience-parameterised `view` plus the envelope with its
	 * interaction stack redacted. This is the exact shape `getState` returns and
	 * `broadcastState` pushes.
	 *
	 * @param data - The record to project.
	 * @param audience - Who the snapshot is for.
	 * @returns The redacted, view-bearing snapshot for that audience.
	 */
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
	 * Pushes the fresh per-audience snapshots (table + one per player, each redacted
	 * for its audience) to connected clients via `Sync`. Called after every commit.
	 * Broadcast failures are swallowed (`Effect.ignore`) so a delivery problem never
	 * fails the command that produced the state.
	 *
	 * @param data - The record to broadcast.
	 * @returns Completes after attempting the broadcast; never fails.
	 */
	const broadcastState = Effect.fn( function* ( data: PersistedGameData<State, Config> ) {
		const table = snapshot( data, tableAudience() );
		const playerViews: Record<PlayerId, unknown> = {};
		for ( const player of Object.values( data.players ) ) {
			playerViews[ player.id ] = snapshot( data, playerAudience( player.id ) );
		}

		yield* sync.broadcast( `${ structure.name }:${ data.id }`, { table, playerViews } );
	} );

	// --- Event Sourcing Helpers ------------------------------------------------

	/**
	 * Commits one command: mints an id + timestamp, assembles the commit, appends it
	 * to the log (dropping any redo tail), saves the new snapshot, and broadcasts.
	 * This is a command's single commit point.
	 *
	 * @param work - The already-folded record to persist.
	 * @param meta - Commit metadata.
	 * @param events - The events this command produced.
	 * @returns Completes once the commit is appended, saved, and broadcast.
	 */
	const commitAndSave = Effect.fn( function* (
		work: PersistedGameData<State, Config>,
		meta: CommitMeta,
		events: ReadonlyArray<EngineEvent | Events>
	) {
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
		yield* broadcastState( work );
	} );

	/**
	 * Records a batch of events into the command accumulator: appends them to the
	 * pending event list and folds them onto the working record so subsequent steps
	 * in the same command see the updated state. Mutates and returns `acc`.
	 *
	 * @param acc - The command accumulator (`events` + working `work` record).
	 * @param es - The events to record and fold.
	 * @returns The same accumulator, with `es` appended and folded in.
	 */
	const emit = ( acc: Acc, es: ReadonlyArray<EngineEvent | Events> ) => {
		acc.events.push( ...es );
		acc.work = fold( acc.work, es );
		return acc;
	};

	/**
	 * Enters a phase, accumulating its entry events: `PhaseEntered`, the phase's
	 * `onEnter` effects, and a `CurrentPlayerSet` from `resolveStartingPlayer` when
	 * defined. Does not commit — the caller merges the returned accumulator.
	 *
	 * @param from - The record to transition from.
	 * @param phaseName - The phase to enter.
	 * @returns The accumulator with entry events folded in, or fails with `PhaseNotFound`.
	 */
	const enterPhase = Effect.fn( function* (
		from: PersistedGameData<State, Config>,
		phaseName: keyof PhaseMoves
	) {
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

	/**
	 * Folds events onto a record, routing game events through the game's `apply`
	 * (the only state-changer) and engine events through `engineApply`.
	 *
	 * @param data - The record to fold onto.
	 * @param events - The events to apply, in order.
	 * @returns The record after folding.
	 */
	const fold = (
		data: PersistedGameData<State, Config>,
		events: ReadonlyArray<EngineEvent | Events>
	) => foldEvents( structure.apply, data, events );

	/**
	 * Rebuilds the current record from scratch by folding the log from its genesis
	 * snapshot up to (and including) the cursor. Used by `undo`/`redo`, where the
	 * cached snapshot no longer matches the cursor.
	 *
	 * @returns The refolded record, or fails with `CorruptState` if the log no longer decodes.
	 */
	const refold = Effect.fn( function* () {
		const { base, commits, cursor } = yield* log.read();
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

	/**
	 * Reads the current state as a snapshot redacted for the authenticated caller.
	 * The audience is derived server-side from `userId` (never client-supplied), so a
	 * member only ever sees their own private slice.
	 *
	 * @param userId - The authenticated caller's id.
	 * @returns The snapshot, or fails with `NotAMember`/`GameNotFound`/`CorruptState`.
	 */
	const getState = Effect.fn( function* ( userId: PlayerId ) {
		const data = yield* load();
		yield* assertMember( data, userId );
		return snapshot( data, playerAudience( userId ) );
	} );

	/**
	 * Derives the action feed from the committed event log: maps each game (non-
	 * engine) event through the game's `describe` — redacted for the audience — and
	 * stamps it with the commit's time/actor. Empty when the game defines no
	 * `describe`.
	 *
	 * @param userId - The authenticated caller's id (drives redaction).
	 * @returns The ordered, human-readable feed entries.
	 */
	const getLog = Effect.fn( function* ( userId: PlayerId ) {
		const data = yield* load();
		yield* assertMember( data, userId );
		const audience = playerAudience( userId );
		const entries: Array<typeof LogEntry.Type> = [];
		if ( !structure.describe ) {
			return entries;
		}

		const { commits, cursor } = yield* log.read();
		for ( const raw of commits.slice( 0, cursor + 1 ) ) {
			const commit = yield* Schema.decodeUnknownEffect( GameEventsCommit )( raw ).pipe(
				Effect.mapError( ( issue ) => new CorruptState( {
					id: data.id,
					reason: String( issue )
				} ) ) );

			for ( const ev of commit.events ) {
				if ( isEngineEvent( ev ) ) {
					continue;
				}

				const text = structure.describe( ev, data.players, data.config, audience );
				if ( text ) {
					const logEntry = LogEntry.make( { ...commit, kind: ev._tag, text } );
					entries.push( logEntry );
				}
			}
		}

		return entries;
	} );

	// --- lifecycle commands ----------------------------------------------------

	/**
	 * Creates a fresh game: runs the game's `setup`, writes the genesis snapshot as
	 * the log's base, and persists it in `CREATED` status with no players.
	 *
	 * @param payload - The new game's id, code, config, and optional seed.
	 * @returns The created game's id.
	 */
	const initialize = Effect.fn( function* ( payload: InitializeInput<Config> ) {
		// The seed is minted before `setup` runs so the genesis state can be drawn
		// from it — same seed, same starting board.
		const seed = payload.seed ?? generateId();
		const state = structure.setup(
			payload.config,
			( salt = "" ) => makeRng( hashSeed( seed, 0, "setup", salt ) )
		);

		const genesis = PersistedData.make( {
			seed,
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

	/**
	 * Seats a player: runs the `onJoin` hook, emits `PlayerJoined`, and — when the
	 * join fills the game — either marks it `PLAYERS_READY` (manual start) or
	 * schedules an auto-start alarm. Re-joining an existing seat is an idempotent
	 * no-op.
	 *
	 * @param playerInfo - The joining player (human or bot).
	 * @returns The game id/code, or fails with `GameFull`/`GameNotFound`/`CorruptState`.
	 */
	const join = Effect.fn( function* ( playerInfo: PlayerInfo ) {
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

	/**
	 * Fills every empty seat with a generated bot by `join`-ing bot players until
	 * the game is at capacity. Only a seated player may add bots to their game.
	 *
	 * @param userId - The authenticated caller's id.
	 * @returns Completes once the roster is full, or fails with `NotAMember`.
	 */
	const addBots = Effect.fn( function* ( userId: PlayerId ) {
		const data = yield* load();
		yield* assertMember( data, userId );
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

	/**
	 * Starts a full game: runs the `onStart` hook, enters the initial phase (for a
	 * phased structure), flips status to `IN_PROGRESS`, and schedules the first bot
	 * turn if the opening actor is a bot. Internal — no membership check, so it can
	 * be driven by the system `auto-start` alarm. The public `start` gates on it.
	 *
	 * @returns Completes once the game is started, or fails with `CannotStart`/`PhaseNotFound`.
	 */
	const startInternal = Effect.fn( function* () {
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
	 * Starts a full game on behalf of a seated player. Only a member may start their
	 * game; otherwise defers to `startInternal`.
	 *
	 * @param userId - The authenticated caller's id.
	 * @returns Completes once started, or fails with `NotAMember`/`CannotStart`/`PhaseNotFound`.
	 */
	const start = Effect.fn( function* ( userId: PlayerId ) {
		yield* assertMember( yield* load(), userId );
		yield* startInternal();
	} );

	/**
	 * Runs the standard end-of-move tail, accumulating its events: advance the turn,
	 * resolve the next player or phase transition, and — when `endIf` is met — run
	 * `onEnd` and emit `GameCompleted`. Shared by a normal move and by an
	 * interaction stack draining back to normal flow.
	 * @param acc - The command accumulator to extend.
	 * @param actorId - The player whose action triggered the tail.
	 * @param move - The move name (passed to `resolveNextPlayer`).
	 * @param fromData - The record before the move, supplying the phase it was made in.
	 * @param [advance] - Whether to advance the turn/next-player (`false` for `endsTurn: false`); completion is still evaluated.
	 * @returns Completes once the tail events are accumulated.
	 */
	const advanceTail = (
		acc: Acc,
		actorId: PlayerId,
		move: string,
		fromData: PersistedGameData<State, Config>,
		advance: boolean = true
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
	 * Drains the interaction stack, resolving as many completed top frames as
	 * possible. Emits `InteractionResolved` (which pops the frame) BEFORE running
	 * the frame's `resolve`, so a nested `openInteraction` from `resolve` pushes a
	 * fresh incomplete frame and the loop halts awaiting its responses rather than
	 * spinning. Halts on the first incomplete or unknown-kind top frame.
	 *
	 * @param acc - The command accumulator to extend with resolve effects.
	 * @returns Completes when the top frame is incomplete or the stack is empty.
	 */
	const runResolveLoop = Effect.fn( function* ( acc: Acc ) {
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

	/**
	 * The generic move pipeline for every declared move. Loads the game, applies the
	 * central guards (in-progress, move exists, `enabledWhen`), then routes to one of
	 * two branches: an open reaction window (validate → `InteractionResponded` →
	 * `execute` → `runResolveLoop`, suppressing turn advancement until the stack
	 * drains) or the normal branch (phase/turn gate → `validate` → `beforeMove` →
	 * `execute` → `afterMove` → `advanceTail`, unless the move opened a window).
	 * Finally commits, then archives a completed game or schedules the next bot.
	 *
	 * @param moveType - The move name being submitted.
	 * @param input - The move's decoded input.
	 * @param playerInfo - The acting player.
	 * @returns Completes once committed, or fails with a `MoveError`
	 * (e.g. `NotYourTurn`, `InvalidMove`).
	 */
	const submitMove = <MoveType extends keyof MoveInputs>(
		moveType: MoveType,
		input: MoveInputs[MoveType][ "Type" ],
		playerInfo: PlayerInfo
	) => Effect.gen( function* () {

		const move = String( moveType );
		const data = yield* load();
		yield* assertMember( data, playerInfo.id );

		if ( data.status !== "IN_PROGRESS" ) {
			return yield* new GameNotInProgress( { status: data.status } );
		}

		const moveDef = structure.moves[ moveType ];

		// config-driven capability gate — a variant/house-rule may disable a move.
		if ( moveDef.enabledWhen && !moveDef.enabledWhen( data.config ) ) {
			return yield* new MoveNotAllowed( { move } );
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
				? idef.canRespond( readonly( data ), active, playerInfo.id )
				: active.mode === "sequential"
					? nextSequentialResponder( active ) === playerInfo.id
					: active.responders.includes( playerInfo.id ) &&
					!( playerInfo.id in active.responses );

			if ( !allowed ) {
				return yield* new NotYourTurn( {
					playerId: playerInfo.id,
					currentPlayer: data.context.currentPlayer
				} );
			}

			const error = moveDef.validate( readonly( data ), playerInfo.id, input );
			if ( error ) {
				return yield* error;
			}

			emit( acc, [
				InteractionResponded.make( {
					playerId: playerInfo.id,
					response: input
				} )
			] );

			emit( acc, moveDef.execute( readonly( acc.work, "execute" ), playerInfo.id, input ) );

			yield* runResolveLoop( acc );

			// The whole stack drained → resume normal flow from the original actor
			// (the bottom frame's initiator = the move that opened the window).
			if ( !activeInteraction( acc.work.context ) ) {
				const originalActor = data.context.interactions?.[ 0 ]?.initiator ?? playerInfo.id;
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
				? moveDef.canMove( readonly( data ), playerInfo.id )
				: data.context.currentPlayer === playerInfo.id;

			if ( !allowed ) {
				return yield* new NotYourTurn( {
					playerId: playerInfo.id,
					currentPlayer: data.context.currentPlayer
				} );
			}

			// `beforeMove` runs BEFORE `validate` so both it and `execute` judge the
			// same state. A hook that rolls the board forward (callbreak opening the
			// next trick once the previous one is won) would otherwise leave
			// `validate` reading a snapshot `execute` never sees, and it would reject
			// legal moves. Nothing is committed unless the whole command succeeds, so
			// emitting here and then failing validation is a no-op.
			if ( structure.hooks?.beforeMove ) {
				emit(
					acc,
					structure.hooks.beforeMove( readonly( acc.work, "beforeMove" ), playerInfo.id, move )
				);
			}

			const error = moveDef.validate( readonly( acc.work ), playerInfo.id, input );
			if ( error ) {
				return yield* error;
			}

			emit(
				acc,
				moveDef.execute(
					readonly( acc.work, "execute" ),
					playerInfo.id,
					input
				)
			);

			if ( structure.hooks?.afterMove ) {
				emit(
					acc,
					structure.hooks.afterMove(
						readonly( acc.work, "afterMove" ),
						playerInfo.id,
						move
					)
				);
			}

			// If the move opened a reaction window, DO NOT advance the turn — wait
			// for responses. Otherwise run the standard tail, advancing the turn
			// only when the move ends it (`endsTurn`, default true).
			if ( !activeInteraction( acc.work.context ) ) {
				const endsTurn = typeof moveDef.endsTurn === "function"
					? moveDef.endsTurn( readonly( acc.work ), playerInfo.id, input )
					: moveDef.endsTurn ?? true;

				yield* advanceTail( acc, playerInfo.id, move, data, endsTurn );
			}
		}

		const commitMeta = {
			command: "submitMove",
			actor: playerInfo.id,
			moveType: move
		};

		yield* commitAndSave( acc.work, commitMeta, acc.events );

		if ( acc.work.status !== "COMPLETED" ) {
			yield* scheduleBotIfNeeded( acc.work );
		}
	} );

	// --- Undo / Redo ----------------------------------------------------

	/**
	 * Steps the log cursor back one commit and rebuilds state from it: `refold`,
	 * save the snapshot, `reconcile` scheduled work, and broadcast.
	 *
	 * @param playerInfo - The requesting player (audience for the returned snapshot).
	 * @returns The rebuilt snapshot, or fails with `NothingToUndo` at genesis.
	 */
	const undo = Effect.fn( function* ( playerInfo: PlayerInfo ) {
		yield* assertMember( yield* load(), playerInfo.id );
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

	/**
	 * Steps the log cursor forward one commit and rebuilds state from it (available
	 * until a new command drops the redo tail): `refold`, save, `reconcile`, broadcast.
	 *
	 * @param playerInfo - The requesting player (audience for the returned snapshot).
	 * @returns The rebuilt snapshot, or fails with `NothingToRedo` at the newest commit.
	 */
	const redo = Effect.fn( function* ( playerInfo: PlayerInfo ) {
		yield* assertMember( yield* load(), playerInfo.id );
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

	/**
	 * Re-derives scheduled work after a time-travel (undo/redo): cancels every timer,
	 * then reschedules a bot turn if the (possibly changed) actor is a bot.
	 *
	 * @param data - The rebuilt record to reconcile timers against.
	 * @returns Completes once timers are reconciled.
	 */
	const reconcile = Effect.fn( function* ( data: PersistedGameData<State, Config> ) {
		yield* scheduler.cancelAll();
		yield* scheduleBotIfNeeded( data );
	} );

	/**
	 * Resolves who is expected to act next: while a reaction window is open, the
	 * pending responder (the next sequential responder, or any simultaneous responder
	 * who still owes an answer); otherwise the normal `currentPlayer`. Used to decide
	 * whether — and for whom — to schedule a bot turn.
	 *
	 * @param data - The current record.
	 * @returns The player to act, or `undefined` if none is pending.
	 */
	const whoBotShouldAct = ( data: PersistedGameData<State, Config> ) => {
		const active = activeInteraction( data.context );
		if ( active ) {
			return active.mode === "sequential"
				? nextSequentialResponder( active )
				: active.responders.find( ( id ) => !( id in active.responses ) );
		}

		return data.context.currentPlayer;
	};

	/**
	 * Schedules a delayed `bot` alarm when the game is in progress and the player to
	 * act (`whoBotShouldAct`) is a bot; otherwise does nothing.
	 *
	 * @param data - The current record.
	 * @returns Completes once the alarm is (or is not) scheduled.
	 */
	const scheduleBotIfNeeded = Effect.fn( function* ( data: PersistedGameData<State, Config> ) {
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

	/**
	 * Tears down the game's durable footprint: cancels every scheduled timer and
	 * clears the persisted snapshot.
	 *
	 * @returns Completes once timers are cancelled and storage is cleared.
	 */
	const cleanup = Effect.fn( function* () {
		yield* scheduler.cancelAll();
		yield* store.clear();
	} );

	/**
	 * The Durable Object alarm entry point. Collects every timer now due, then fires
	 * a scheduled auto-start or plays the pending actor's bot move (the actor may be
	 * a reaction responder, not `currentPlayer`). Failures are logged, never thrown —
	 * an alarm must not throw back into the runtime.
	 *
	 * @returns Completes once due alarms are handled.
	 */
	const alarm = Effect.fn( function* () {
		// Collect every timer now due (multiple may coincide) and re-arm the host.
		const due = yield* scheduler.due();
		if ( due.length === 0 ) {
			return;
		}

		if ( due.includes( "auto-start" ) ) {
			yield* startInternal().pipe(
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

		yield* submitMove( move.moveType, move.input, current ).pipe(
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
		undo,
		redo,
		cleanup,
		alarm,
		...moves
	};
} );

