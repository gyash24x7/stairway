import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FiberHandle from "effect/FiberHandle";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

import * as Entity from "effect/cluster/Entity";
import { Rpc } from "effect/rpc";

import { produce } from "immer";

import { Generator } from "@/shared/utils/generator";
import type { Rng } from "@/shared/utils/rng";
import { makeRng } from "@/shared/utils/rng";
import {
	AlreadyJoined,
	AutoPlayUnavailable,
	GameNotFound,
	HintUnavailable,
	InteractionCascade,
	InteractionInProgress,
	InteractionNotDeclared,
	InteractionStale,
	MoveNotAllowed,
	NothingToRedo,
	NothingToUndo,
	NotOnTeam,
	NotRespondingTo,
	NotYourTurn,
	PassNotAllowed,
	PhaseNotFound,
	RedoNotAllowed,
	RematchUnavailable,
	TeamAlreadyNamed,
	TeamFull,
	TeamNotFound,
	UndoNotAllowed
} from "@/swish/errors";
import type {
	AutoPlayInput,
	BaseGameConfig,
	BaseGameEvent,
	EngineEvent,
	InteractionFrame,
	JoinTeamInput,
	LiveGameResident,
	NameTeamInput,
	PassInteractionInput,
	RematchInput,
	SealedCommit,
	SwishUser
} from "@/swish/schema";
import {
	CommitId,
	CommitMeta,
	CurrentPlayerSet,
	GameChanged,
	GameCompleted,
	GameContext,
	GameDocument,
	GameId,
	GameRecord,
	GameRef,
	GameRuntime,
	GameView,
	Genesis,
	InitializeInput,
	InteractionClosed,
	InteractionExpired,
	InteractionOpened,
	InteractionOption,
	InteractionPassed,
	InteractionResponded,
	PhaseEntered,
	PhaseExited,
	PlayerAudience,
	PlayerId,
	PlayerInfo,
	PlayerJoined,
	RematchSource,
	ResultsResolved,
	SeatOrderSet,
	StatusChanged,
	TableAudience,
	TeamAssigned,
	TeamLeft,
	TeamName,
	TeamNamed,
	TurnAdvanced,
	TurnResumed,
	TurnSuspended
} from "@/swish/schema";
import { Accumulator, foldEvents } from "@/swish/server/events";
import { makeGameLedger } from "@/swish/server/ledger";
import { makeSwishRpcs } from "@/swish/server/rpc";
import { makeGameStore } from "@/swish/server/store";
import type { GameStructure } from "@/swish/server/structure";
import {
	activeFrame,
	activeFrameChanged,
	assertCanStart,
	assertHasSeat,
	assertInProgress,
	assertJoinable,
	assertMember,
	assertNoOpenInteraction,
	assertNotJoined,
	balanceTeams,
	canRespond,
	compileStandings,
	dieOnClusterError,
	dieOnClusterErrorStream,
	frameById,
	interleaveSeats,
	isMachinePlayed,
	nextInOrder,
	pendingActorsChanged,
	redactInteractions,
	rematchPlanFor,
	replay,
	requireActiveFrame,
	requireCurrentPlayer,
	requireTeams,
	resolveClock,
	toPlayerInfo,
	validateTeamConfig
} from "@/swish/utils";


/**
 * How many windows may resolve into one another inside a single commit before
 * the engine calls it a runaway.
 *
 * Generous on purpose: a challenge that settles into a block that is itself
 * challenged and costs both players a card is four deep, and a game is entitled
 * to chain further than any rulebook currently does. What it is guarding against
 * is a window whose `onResolve` reopens it, which is not a deep chain but an
 * endless one.
 */
const MAX_INTERACTION_CASCADE = 64;


/**
 * Builds a game's runtime from its declarative `GameStructure`.
 * Yields the command surface a host drives the game through -
 * - Lifecycle: init, joinGame, addBots, joinTeam, leaveTeam, nameTeam, startGame
 * - Play: submitMove
 * - History: undo, redo
 * - Reads: getView
 *
 * @typeParam Name - The game's unique name; half of the `GameAddress` the host services take.
 * @typeParam State - The game-owned state shape (opaque to the engine).
 * @typeParam Config - The game config, extending `BaseGameConfig`.
 * @typeParam MoveInputs - Map of move name → input schema.
 * @typeParam PhaseMoves - Map of phase name → the move names legal in it.
 * @typeParam InteractionMoves - Map of window kind → the move names it accepts.
 * @typeParam Events - The game's domain event union.
 * @typeParam View - The redacted game info built for one audience
 *
 * @param structure - The game's declarative contract.
 * @returns The game's entity and the layer that gives it behaviour.
 */
export const makeEngine = <
	Name extends string,
	State,
	Config extends BaseGameConfig,
	MoveInputs extends Record<string, unknown>,
	PhaseMoves extends Record<string, ReadonlyArray<keyof MoveInputs>>,
	InteractionMoves extends Record<string, ReadonlyArray<keyof MoveInputs>>,
	Events extends BaseGameEvent,
	View
>(
	structure: GameStructure<
		Name,
		State,
		Config,
		MoveInputs,
		PhaseMoves,
		InteractionMoves,
		Events,
		View
	>
) => {

	const GenesisSchema = Genesis( structure.schemas.state, structure.schemas.config );
	const DocumentSchema = GameDocument(
		structure.schemas.state,
		structure.schemas.config,
		structure.schemas.events
	);
	const RecordSchema = GameRecord( structure.schemas.state, structure.schemas.config );
	const ViewSchema = GameView( structure.schemas.view, structure.schemas.config );
	const InitializeInputSchema = InitializeInput( structure.schemas.config );

	const initialContext = GameContext.make( {
		turn: 0,
		players: [],
		teams: {},
		teamNames: {},
		interactions: [],
		interactionCount: 0
	} );

	const seedRecord = ( genesis: Genesis<State, Config> ) => RecordSchema.make( {
		id: genesis.id,
		config: genesis.config,
		state: genesis.initialState,
		version: 0,
		players: {},
		status: "CREATED" as const,
		context: initialContext
	} );

	const foldDocument = ( { genesis, ...rest }: GameDocument<State, Config, Events> ) =>
		replay( seedRecord( genesis ), { ...rest, apply: structure.apply } );

	/**
	 * Which questions this game can answer for a seat. A game that declares no
	 * policy keeps no clock for the thing that policy would have answered: a
	 * timeout would have nothing to hand the decision to.
	 */
	const policies = {
		botMove: structure.botMove !== undefined,
		botRespond: structure.botRespond !== undefined
	};

	/**
	 * The machine-played seats that may move right now without holding the turn.
	 *
	 * Only a move that overrides `canMove` can be played out of turn, so a game
	 * that declares none — every game but a race — races nobody, and its bots go
	 * on being paced through the cursor exactly as before. Where one does, every
	 * machine-played seat it admits is played on one shared clock rather than
	 * waiting for the cursor to reach it: the cursor visits one seat at a time, and
	 * a table of bots paced through it would take a race in single file.
	 *
	 * The seat the cursor is on is included when it qualifies, and its own bot
	 * clock is then dropped in favour of this one — two clocks for one seat would
	 * have it move twice. A window open is a question for somebody, and while it
	 * is open nobody moves, so then nobody races either.
	 *
	 * @param record - The current record.
	 * @param runtime - The runtime holding the handed-over seats.
	 * @returns The seats to play on the race clock, in seating order.
	 */
	const racingSeats = ( record: GameRecord<State, Config>, runtime: GameRuntime ) => {
		if ( !structure.botMove || record.status !== "IN_PROGRESS" || activeFrame( record.context ) ) {
			return [];
		}

		const phase = structure.phases?.[ record.context.phase as keyof PhaseMoves ];
		const outOfTurn = ( Object.keys( structure.moves ) as Array<keyof MoveInputs> )
			.filter( move => !phase || phase.moves.includes( move ) )
			.flatMap( move => {
				const { canMove, enabledWhen } = structure.moves[ move ];
				return canMove && ( !enabledWhen || enabledWhen( record.config ) ) ? [ canMove ] : [];
			} );

		if ( outOfTurn.length === 0 ) {
			return [];
		}

		const data = { state: record.state, config: record.config, context: record.context };
		return record.context.players.filter( playerId =>
			isMachinePlayed( record, runtime, playerId )
			&& outOfTurn.some( canMove => canMove( data, playerId ) )
		);
	};

	/**
	 * Fills a window in with its kind's declaration on the way into a commit.
	 *
	 * A game opens a window by naming the kind and who is being asked; everything
	 * else — how long they have, whether they may decline, what the options are —
	 * is written down once on the structure and copied onto the event here. Only
	 * then is the event recorded, so the log holds windows that are complete in
	 * themselves and a structure whose defaults change tomorrow cannot reinterpret
	 * a game played today.
	 *
	 * Runs on the way in only. `foldEvents` and `replay` read stored events and
	 * take them as final.
	 */
	const normaliseEvent = ( event: EngineEvent | Events ) => {
		if ( !Schema.is( InteractionOpened )( event ) ) {
			return event;
		}

		const definition = structure.interactions?.[ event.kind ];
		if ( !definition ) {
			return event;
		}

		return InteractionOpened.make( {
			...event,
			options: event.options ?? definition.moves.map(
				move => InteractionOption.make( { move: String( move ) } )
			),
			resolution: event.resolution ?? definition.resolution ?? "first",
			allowPass: event.allowPass ?? definition.allowPass ?? true,
			secret: event.secret ?? definition.secret ?? false,
			timeoutMillis: event.timeoutMillis ?? definition.timeoutMillis
		} );
	};

	const makeAccumulator = ( record: GameRecord<State, Config> ) =>
		new Accumulator<State, Config, Events>( record, structure.apply, normaliseEvent );

	const SwishEngine = Entity.fromRpcGroup(
		Str.capitalize( Str.toLowerCase( structure.name ) ),
		makeSwishRpcs(
			structure.schemas.view,
			structure.schemas.config,
			structure.schemas.moves
		)
	);

	const SwishEngineLive = SwishEngine.toLayer(
		Effect.gen( function* () {
			const address = yield* Entity.CurrentAddress;
			const gameId = GameId.make( address.entityId );

			const generator = yield* Generator;
			const ledger = yield* makeGameLedger<State, Config, Events>( structure.name );
			const store = yield* makeGameStore( structure.name, structure.schemas );
			const hub = yield* PubSub.sliding<GameChanged>( 1024 );

			const resident = yield* Ref.make( Option.none<LiveGameResident<State, Config, Events>>() );

			/**
			 * The turn clock: at most one fiber, sleeping until the pending seat's
			 * deadline and then sending this game a `tick`.
			 *
			 * A `FiberHandle` rather than a bare fiber for two reasons. Arming again
			 * interrupts whatever was armed before, so a clock can never be counted
			 * twice; and the handle hangs off the entity's own scope, so passivation
			 * and a defect restart both put the timer away without any path having to
			 * remember to.
			 */
			const timer = yield* FiberHandle.make();

			/**
			 * A client onto this game's own entity, resolved once. `Sharding` is closed
			 * over here, which is what keeps it out of the handlers' requirements —
			 * `toLayer` drops `CurrentAddress` from what the *build* needs but not from
			 * what the *handlers* need, so a service reached for inside `armTimer`
			 * would surface on `EngineLive` for nobody to provide.
			 */
			const clientFor = yield* SwishEngine.client;


			/**
			 * Points the turn clock at the position this record is in.
			 *
			 * Called from `persist`, so every write re-arms and the clock cannot drift
			 * from the game it belongs to. Called again at activation, so a table that
			 * came back after a restart picks its clock up from the durable stamp
			 * rather than starting it over.
			 *
			 * The tick is *sent* to this entity rather than run here. That is what puts
			 * it in line behind whatever the game is already doing — the entity runs one
			 * command at a time — instead of folding a bot's move into somebody else's
			 * commit. It is sent from a forked fiber for a harder reason: sending
			 * resolves the entity through the runner's map, and doing that from inside
			 * the entity's own build would wait on a latch that only this build can
			 * open.
			 *
			 * Nothing here pins the entity, and it deliberately does not use
			 * `Entity.keepAlive`: that is a *persisted* message, so holding residency
			 * for an armed clock would write a row to `cluster_messages` on every turn
			 * of every game — a durable queue write to pay for an in-memory `sleep`.
			 * It would also buy almost nothing, because a clock is only lost to
			 * passivation in a case that does not arise. A table being played by bots
			 * ticks every `botDelayMillis`, and each tick is a request that resets the
			 * idle timer, so it keeps itself resident. A human seat is only at risk if
			 * its `moveTimeoutMillis` outlasts `entityMaxIdleTime` (a minute by
			 * default) *and* nobody is subscribed — and a subscription pins the entity
			 * on its own. What is left is a table nobody is watching, where nobody is
			 * waiting on the seat either; the clock lapses unnoticed and the activation
			 * re-arm below fires it the moment somebody next looks.
			 *
			 * Under `SingleRunner` a shard is never reassigned, so the fiber is only ever
			 * lost along with the entity that owns it, and activation re-arms. A
			 * multi-runner deployment would not have that: a rebalance would interrupt
			 * the fiber on the old runner with nothing to wake the new one until somebody
			 * sent it a message. That is where a `DeliverAt`-scheduled message would earn
			 * its place — as a coarse backstop for `moveTimeoutMillis` only, never for
			 * `botDelayMillis`, whose second would be lost in the mailbox poll interval.
			 *
			 * @param version - The version the timer is armed against.
			 * @param deadline - When to wake, or `undefined` to keep no clock.
			 */
			const armAt = ( version: number, deadline: number | undefined ) =>
				Effect.suspend( () => {
					if ( deadline === undefined ) {
						return FiberHandle.clear( timer );
					}

					return FiberHandle.run( timer, Effect.gen( function* () {
						const now = yield* Clock.currentTimeMillis;
						yield* Effect.sleep( Duration.millis( Math.max( 0, deadline - now ) ) );
						yield* clientFor( gameId ).tick( { version }, { discard: true } );
					} ).pipe(
						Effect.catchCause(
							cause => Effect.logWarning( "swish: could not deliver the turn clock", cause )
						),
						Effect.annotateLogs( { game: structure.name, gameId } )
					) );
				} );

			/**
			 * When the engine next has to wake: the turn clock or the race clock,
			 * whichever is sooner.
			 *
			 * The race is kept out of `deadline` itself because `deadline` is what a
			 * client counts down. A person whose turn it is has their own clock, and
			 * showing them the bots' few seconds instead, over and over, would be a lie
			 * about how long they have.
			 *
			 * @param live - The game as it now stands.
			 * @returns The instant to wake at, or `undefined` to keep no clock.
			 */
			const wakeAt = ( { record, document }: LiveGameResident<State, Config, Events> ) => {
				const { deadline, raceStartedAt } = document.runtime;
				const { botDelayMillis } = record.config;
				const race = raceStartedAt === undefined || botDelayMillis === undefined
					? undefined
					: raceStartedAt + botDelayMillis;

				const due = [ deadline, race ].filter( at => at !== undefined );
				return due.length === 0 ? undefined : Math.min( ...due );
			};

			/**
			 * Points the turn clock at the position this record is in.
			 * @param live - The game as it now stands.
			 */
			const armTimer = ( live: LiveGameResident<State, Config, Events> ) =>
				armAt( live.document.version, wakeAt( live ) );


			yield* store.load( gameId ).pipe(
				Effect.map( Option.map( document => ( { document, record: foldDocument( document ) } ) ) ),
				Effect.tap( live => Ref.set( resident, live ) ),
				Effect.flatMap( Option.match( { onNone: () => Effect.void, onSome: armTimer } ) )
			);


			const requireLive = () => Ref.get( resident ).pipe(
				Effect.flatMap( Option.match( {
					onNone: () => Effect.fail( new GameNotFound( { id: gameId } ) ),
					onSome: ( live ) => Effect.succeed( live )
				} ) )
			);


			/**
			 * Moves a finished game out of the hot store and into Postgres.
			 *
			 * The log is buffered in Redis for the whole game and is the only copy of
			 * the history until this runs, so this is the moment it becomes durable.
			 * The results for each player are recorded and status is updated.
			 *
			 * Only the commits up to the cursor are archived. Anything past it was
			 * undone and never redone, so it is not part of what happened — at
			 * completion there is nothing there anyway, since sealing a commit
			 * truncates the redo tail.
			 */
			const archiveGame = Effect.fn( function* ( live: LiveGameResident<State, Config, Events> ) {
				yield* ledger.updateStatus( gameId, live.record.status );
				if ( live.record.results ) {
					yield* ledger.updateResults( gameId, live.record.results );
				}

				yield* ledger.recordCommits( gameId, live.document.log.slice( 0, live.document.cursor ) );
				yield* store.remove( gameId );
			} );


			/**
			 * The only way anything is written.
			 *
			 * Three things ride along with every write, and they ride here rather than
			 * at each caller because there is one write path and eight callers.
			 *
			 * `revision` counts the write itself, committed or not, and is what a client
			 * dedupes on. `turnStartedAt` is re-stamped when the seat waiting to act has
			 * changed — *not* on every write, because `autoPlay` writes without moving
			 * the turn, and a stamp that followed it would let a player keep their seat
			 * forever by flicking the switch. And the clock is recomputed and re-armed
			 * against the record as it now stands, so no path has to remember to wind it.
			 *
			 * The clock is armed after the publish, so a subscriber sees the position
			 * before the next tick can land on it.
			 *
			 * @param live - The game to write.
			 * @returns The game as written, stamps and all.
			 */
			const persist = Effect.fn( function* ( live: LiveGameResident<State, Config, Events> ) {
				const previous = yield* Ref.get( resident );
				const now = yield* Clock.currentTimeMillis;
				const before = Option.getOrUndefined( previous )?.record;
				const inProgress = live.record.status === "IN_PROGRESS";

				const restamp = inProgress && (
					live.document.runtime.turnStartedAt === undefined
					|| pendingActorsChanged( before, live.record )
				);

				// Only a *different* window restarts the window clock, so a deadline is
				// fixed from the moment it was set and cannot be pushed back by
				// responders taking their time over it.
				const reopened = inProgress && (
					live.document.runtime.interactionStartedAt === undefined
					|| activeFrameChanged( before, live.record )
				);

				const turnStartedAt = restamp ? now : live.document.runtime.turnStartedAt;
				const interactionStartedAt = activeFrame( live.record.context ) === undefined
					? undefined
					: reopened ? now : live.document.runtime.interactionStartedAt;

				// The race clock starts when there is first somebody to race, and is
				// otherwise left alone: only the race itself re-stamps it, by clearing it
				// before its moves are written, so nobody else's move can push it back.
				const racers = racingSeats( live.record, live.document.runtime );
				const { botDelayMillis } = live.record.config;
				const raceStartedAt = racers.length === 0 || botDelayMillis === undefined
					? undefined
					: live.document.runtime.raceStartedAt ?? now;

				const runtime = { ...live.document.runtime, turnStartedAt, interactionStartedAt };
				const clock = resolveClock( live.record, runtime, policies );
				const { interactionDeadline } = clock;

				// A seat that races is played on the race clock alone. Keeping its turn
				// clock as well would have it answer twice, once for each.
				const currentPlayer = live.record.context.currentPlayer;
				const deadline = currentPlayer !== undefined && racers.includes( currentPlayer )
					? undefined
					: clock.deadline;

				const next = produce( live, draft => {
					draft.document.runtime.revision++;
					draft.document.runtime.turnStartedAt = turnStartedAt;
					draft.document.runtime.raceStartedAt = raceStartedAt;
					draft.document.runtime.interactionStartedAt = interactionStartedAt;
					draft.document.runtime.deadline = deadline;
					draft.document.runtime.interactionDeadline = interactionDeadline;
				} );

				yield* store.save( gameId, next.document );
				yield* Ref.set( resident, Option.some( next ) );
				yield* PubSub.publish( hub, GameChanged.make( {
					game: structure.name,
					gameId: next.record.id,
					version: next.document.version
				} ) );

				yield* armTimer( next );

				if ( next.record.status === "COMPLETED" && before?.status !== "COMPLETED" ) {
					yield* archiveGame( next ).pipe(
						Effect.catchCause(
							cause => Effect.logError( "swish: could not archive the completed game", cause )
						),
						Effect.annotateLogs( { game: structure.name, gameId } )
					);
				}

				return next;
			} );


			const seal = (
				acc: Accumulator<State, Config, Events>,
				options: {
					readonly id: CommitId;
					readonly at: number;
					readonly meta: CommitMeta;
				}
			) => {
				const events = acc.events;
				if ( events.length === 0 ) {
					return Option.none<SealedCommit<State, Config, Events>>();
				}

				return Option.some<SealedCommit<State, Config, Events>>( {
					commit: { id: options.id, at: options.at, events, meta: options.meta },
					record: { ...acc.work, version: acc.work.version + 1 }
				} );
			};


			const applyCommit = Effect.fn( function* (
				live: LiveGameResident<State, Config, Events>,
				sealed: Option.Option<SealedCommit<State, Config, Events>>
			) {
				if ( Option.isNone( sealed ) ) {
					return live;
				}

				// Built by hand rather than with `produce`, and deliberately: a commit and
				// the record it leaves behind are already new values, so there is nothing
				// here to copy-on-write. Drafting them into the document instead leaves
				// immer's proxies inside the thing that gets stored, the next commit
				// drafts *those*, and the wrappers compound — a table slows to a stop
				// somewhere around its twentieth move. A short game never reaches it.
				return yield* persist( {
					record: sealed.value.record,
					document: {
						...live.document,
						log: [
							...live.document.log.slice( 0, live.document.cursor ),
							sealed.value.commit
						],
						cursor: live.document.cursor + 1,
						version: sealed.value.record.version
					}
				} );
			} );


			/**
			 * Builds a commit and writes it.
			 *
			 * Generic in the build's error so a refusal raised while the events are
			 * being assembled — a phase nothing declares, a window that will not
			 * settle — reaches the caller as a refusal. Swallowing it into a defect
			 * here would restart the entity and redeliver the command that raised it.
			 */
			const commitWith = <E>(
				live: LiveGameResident<State, Config, Events>,
				meta: CommitMeta,
				build: ( acc: Accumulator<State, Config, Events> ) => Effect.Effect<void, E>
			) => Effect.gen( function* () {
				const acc = makeAccumulator( live.record );
				yield* build( acc );

				const id = CommitId.make( yield* generator.generateId() );
				const at = yield* Clock.currentTimeMillis;

				return yield* applyCommit( live, seal( acc, { id, at, meta } ) );
			} );


			const rngFor = ( record: GameRecord<State, Config>, cursor: number ) =>
				( salt?: string ) => makeRng( record.id, cursor, salt ?? "" );


			/**
			 * The game as one player is allowed to see it.
			 *
			 * The audience is resolved on every read rather than once per caller: a
			 * client watching the lobby takes a seat while it is already watching, and
			 * from that commit on it has to be given its own regions rather than the
			 * table's redaction of them. Reading the roster here is what makes the
			 * stream below pick that up without resubscribing.
			 *
			 * @param playerId - Who the view is being built for.
			 * @returns The redacted view, or `GameNotFound` if the game is no longer live.
			 */
			const viewFor = Effect.fn( function* ( playerId: PlayerId ) {
				const { record, document: { runtime } } = yield* requireLive();
				const { state, config, context, _tag, ...rest } = record;
				const audience = rest.players[ playerId ]
					? PlayerAudience.make( { playerId } )
					: TableAudience.make( {} );

				const view = structure.view( { state, config, context }, audience );

				// The context crosses the wire whole, and an open window is part of it —
				// which is how a client knows it is being asked something at all. A
				// secret window's answers are the one part of it that is not everybody's
				// to read, so they are redacted here, where the audience is known.
				const ctx = redactInteractions( context, audience );
				return ViewSchema.make( { ...rest, config, context: ctx, view, runtime } );
			} );


			/**
			 * Seats a player and, when that fills the table, marks it ready — and starts
			 * it if the game asked to start itself.
			 */
			const seatPlayers = Effect.fn( function* (
				live: LiveGameResident<State, Config, Events>,
				players: ReadonlyArray<PlayerInfo>,
				meta: CommitMeta
			) {
				// Somebody who was watching and is now being seated stops being audience.
				// They are about to appear in `players`, and the same name in both lists
				// reads as two different people. Pruned into the very write the seat
				// arrives in, so no frame a client renders ever shows them twice.
				const watching = players.some(
					player => live.document.runtime.spectators[ player.id ] !== undefined
				);

				const from = watching
					? produce( live, draft => {
						for ( const player of players ) {
							delete draft.document.runtime.spectators[ player.id ];
						}
					} )
					: live;

				const next = yield* commitWith( from, meta, ( acc ) => Effect.sync( () => {
					for ( const player of players ) {
						if ( structure.hooks.onJoin ) {
							acc.accumulate( ...structure.hooks.onJoin( acc.getGameData(), player.id ) );
						}

						acc.accumulate( PlayerJoined.make( { player } ) );
					}

					if ( acc.work.context.players.length === live.record.config.playerCount ) {
						acc.accumulate( StatusChanged.make( { status: "PLAYERS_READY" } ) );
					}
				} ) );

				for ( const player of players ) {
					yield* ledger.createPlayer( gameId, player );
				}

				if ( next.record.status === "PLAYERS_READY" ) {
					yield* ledger.updateStatus( gameId, "PLAYERS_READY" );
					if ( next.record.config.autoStart ) {
						return yield* startGame( next, meta.actor );
					}
				}

				return next;
			} );

			/**
			 * Enters a phase: records it, lets it lay the table out, then seats whoever
			 * opens it. Shared by `start`, which enters the initial phase, and by the move
			 * tail, which enters whatever `resolveNextPhase` chose.
			 *
			 * @param acc - The commit being built.
			 * @param phase - The phase to enter.
			 * @param rng - RNG factory for this commit.
			 */
			const enterPhase = (
				acc: Accumulator<State, Config, Events>,
				phase: keyof PhaseMoves,
				rng: ( salt?: string ) => Rng
			) => Effect.gen( function* () {
				const definition = structure.phases?.[ phase ];
				if ( !definition ) {
					return yield* new PhaseNotFound( { phase: String( phase ) } );
				}

				acc.accumulate( PhaseEntered.make( { phase: String( phase ) } ) );

				if ( definition.onEnter ) {
					acc.accumulate( ...definition.onEnter( acc.getGameData(), rng ) );
				}

				if ( definition.resolveStartingPlayer ) {
					const playerId = definition.resolveStartingPlayer( acc.getGameData() );
					acc.accumulate( CurrentPlayerSet.make( { playerId } ) );
				}
			} );

			/**
			 * Asks the game whether it is over, and closes it out if so.
			 * @param acc - The commit being built.
			 * @returns `true` when the game ended in this commit.
			 */
			const runEndCheck = ( acc: Accumulator<State, Config, Events> ) => {
				if ( !structure.endIf( acc.getGameData() ) ) {
					return false;
				}

				if ( structure.hooks.onEnd ) {
					acc.accumulate( ...structure.hooks.onEnd( acc.getGameData() ) );
				}

				if ( structure.resolveResults ) {
					const results = compileStandings(
						structure.resolveResults( acc.getGameData() ),
						acc.work.context
					);

					acc.accumulate( ResultsResolved.make( { results } ) );
				}

				acc.accumulate( GameCompleted.make( {} ) );
				return true;
			};

			/**
			 * Starts a filled table: sides are balanced and interleaved, the game lays
			 * itself out, and the opening phase is entered.
			 */
			const startGame = Effect.fn( function* (
				live: LiveGameResident<State, Config, Events>,
				actor: PlayerId
			) {
				const cursor = live.document.cursor;
				const rng = rngFor( live.record, cursor );
				const meta = CommitMeta.make( { command: "start", actor } );

				const next = yield* commitWith( live, meta, ( acc ) => Effect.gen( function* () {
					const teams = live.record.config.teams;

					if ( teams ) {
						const context = acc.work.context;
						for ( const assignment of balanceTeams( context.players, teams, context.teams ) ) {
							acc.accumulate( TeamAssigned.make( assignment ) );
						}

						const startingPlayer = acc.work.context.players[ 0 ]!;
						const seatOrder = interleaveSeats(
							acc.work.context.players,
							teams,
							acc.work.context.teams
						);

						acc.accumulate( SeatOrderSet.make( { order: seatOrder } ) );
						acc.accumulate( CurrentPlayerSet.make( { playerId: startingPlayer } ) );
					}

					if ( structure.hooks.onStart ) {
						acc.accumulate( ...structure.hooks.onStart( acc.getGameData(), rng ) );
					}

					acc.accumulate( StatusChanged.make( { status: "IN_PROGRESS" } ) );

					if ( structure.phases && structure.initialPhase !== undefined ) {
						yield* enterPhase( acc, structure.initialPhase, rng );
					}

					// A game that opens with a decision — everybody discarding down, a
					// bidding round before the first turn — opens it in `onStart` or the
					// opening phase's `onEnter`. Anything still waiting is left for the
					// table to answer, and only an unanswerable window settles here.
					if ( activeFrame( acc.work.context ) ) {
						return yield* runInteractionTail( acc, rng );
					}

					runEndCheck( acc );
				} ) );

				yield* ledger.updateStatus( gameId, "IN_PROGRESS" );

				// The sides are final here — balanced, interleaved and committed — so
				// this is the one moment the archive can be told who ended up where.
				// `updateResults` reads the column back at completion to decide which
				// seats were on the winning side, and reads nothing if nobody wrote it.
				if ( live.record.config.teams ) {
					yield* ledger.updateTeams( gameId, next.record.context );
				}

				return next;
			} );

			/**
			 * The tail of a turn-ending move: advance the turn, then either hand the seat on
			 * within the current phase or close that phase out.
			 *
			 * A move made out of turn — one a `canMove` override let through from a seat
			 * the cursor was not on — counts as a turn and can still end the phase, but
			 * it does not move the cursor. The cursor is the seat the table is waiting
			 * on, and somebody else moving does not make that seat any less awaited:
			 * handing the cursor on would restart a stalled player's timeout every time
			 * a quicker one moved, and with bots racing out of turn it would never run
			 * out at all.
			 *
			 * @param acc - The commit being built.
			 * @param playerId - The move actor
			 * @param moveType - The type of move being acted
			 * @param outOfTurn - Whether the actor moved from a seat the cursor was not on
			 * @returns The phase waiting to be entered, or `undefined` when none is.
			 */
			const runEndTurnTail = (
				acc: Accumulator<State, Config, Events>,
				playerId: PlayerId,
				moveType: keyof MoveInputs,
				outOfTurn = false
			) => Effect.gen( function* () {

				acc.accumulate( TurnAdvanced.make( {} ) );

				if ( !structure.phases ) {
					if ( outOfTurn ) {
						return undefined;
					}

					const data = acc.getGameData();
					const nextPlayer = structure.resolveNextPlayer
						? structure.resolveNextPlayer( data, playerId, moveType )
						: nextInOrder( data.context, playerId );

					acc.accumulate( CurrentPlayerSet.make( { playerId: nextPlayer } ) );
					return undefined;
				}

				const name = acc.work.context.phase as keyof PhaseMoves;
				const phase = structure.phases[ name ];
				if ( !phase ) {
					return yield* new PhaseNotFound( { phase: String( name ) } );
				}

				if ( !phase.endIf( acc.getGameData() ) ) {
					if ( phase.resolveNextPlayer && !outOfTurn ) {
						const nextPlayer = phase.resolveNextPlayer( acc.getGameData(), playerId, moveType );
						acc.accumulate( CurrentPlayerSet.make( { playerId: nextPlayer } ) );
					}

					return undefined;
				}

				if ( phase.onExit ) {
					acc.accumulate( ...phase.onExit( acc.getGameData() ) );
				}

				acc.accumulate( PhaseExited.make( { phase: String( name ) } ) );
				return phase.resolveNextPhase( acc.getGameData() );
			} );


			/**
			 * Unwinds every window that has heard all it is going to, then picks the
			 * suspended turn back up if that emptied the stack.
			 *
			 * The tail of any command that touched a window — a response, a pass, a
			 * timeout, and the move that opened one in the first place, since a window
			 * nobody can answer is settled the moment it appears.
			 *
			 * A window is closed *before* it is resolved. `onResolve` is where the next
			 * question in a chain is asked — a block opening a challenge on itself — and
			 * closing first means that question is pushed onto a stack whose top is not
			 * about to be thrown away. It also means `onResolve` reads a position in
			 * which the thing it is resolving is already over, which is the position its
			 * events describe.
			 *
			 * Nothing below the settled window is touched, even though the loop walks
			 * down to it: an outer window is only settled once its own responders have
			 * answered, and `pending` is what says so.
			 *
			 * @param acc - The commit being built.
			 * @param rng - RNG factory for this commit.
			 */
			const runInteractionTail = (
				acc: Accumulator<State, Config, Events>,
				rng: ( salt?: string ) => Rng
			) => Effect.gen( function* () {
				for ( let depth = 0; ; depth++ ) {
					const frame = activeFrame( acc.work.context );

					if ( !frame ) {
						break;
					}

					if ( frame.pending.length > 0 ) {
						return;
					}

					// A game whose windows resolve into each other without end would
					// otherwise fold events until it ran out of memory. There is no depth
					// a real game reaches, so exceeding it is a bug in the rules and is
					// reported as one rather than absorbed.
					//
					// A refusal rather than a defect, which is the difference between
					// stopping and spinning: a defect inside an entity restarts it, and
					// the restart redelivers the very message that caused it, so the guard
					// would fire again on the same input forever.
					if ( depth >= MAX_INTERACTION_CASCADE ) {
						return yield* new InteractionCascade( {
							kind: frame.kind,
							depth: MAX_INTERACTION_CASCADE
						} );
					}

					const definition = structure.interactions?.[ frame.kind as keyof InteractionMoves ];
					if ( !definition ) {
						return yield* new InteractionNotDeclared( { kind: frame.kind } );
					}

					acc.accumulate( InteractionClosed.make( { frameId: frame.id } ) );
					acc.accumulate( ...definition.onResolve( acc.getGameData(), frame, rng ) );
				}

				const suspended = acc.work.context.suspended;
				let nextPhase: keyof PhaseMoves | undefined = undefined;

				if ( suspended ) {
					acc.accumulate( TurnResumed.make( {} ) );
					nextPhase = yield* runEndTurnTail(
						acc,
						suspended.actor,
						suspended.moveType as keyof MoveInputs
					);
				}

				const ended = runEndCheck( acc );
				if ( !ended && nextPhase !== undefined ) {
					yield* enterPhase( acc, nextPhase, rng );
				}
			} );


			/**
			 * Plays one answer into an open window.
			 *
			 * The response half of a move, shared by the player submitting one and by
			 * the engine answering for a seat whose clock ran out. It folds into a
			 * commit the caller owns rather than making its own, which is what lets a
			 * window that expires on several responders at once settle them all in a
			 * single write.
			 *
			 * The gates are the window's, not the turn's: `currentPlayer` has nothing to
			 * say about who may object to a claim, and the phase's move list has nothing
			 * to say either, since the window has already named what it accepts. What
			 * survives is everything about the move itself — its input schema, its
			 * `enabledWhen`, the `beforeMove` hook and its own `validate`.
			 *
			 * @param acc - The commit being built.
			 * @param frame - The open window being answered.
			 * @param playerId - The responder.
			 * @param move - The move they are answering with.
			 * @param input - That move's input, still to be decoded.
			 * @param rng - RNG factory for this commit.
			 */
			const respondInto = (
				acc: Accumulator<State, Config, Events>,
				frame: InteractionFrame,
				playerId: PlayerId,
				move: keyof MoveInputs,
				input: unknown,
				rng: ( salt?: string ) => Rng
			) => Effect.gen( function* () {
				const moveData = structure.moves[ move ];
				if ( !moveData ) {
					return yield* new MoveNotAllowed( { move: Str.String( move ) } );
				}

				if ( !canRespond( frame, playerId, Str.String( move ) ) ) {
					return yield* new NotRespondingTo( {
						playerId,
						frameId: frame.id,
						move: Str.String( move )
					} );
				}

				const decoded = Schema.decodeUnknownExit( structure.schemas.moves[ move ] )( input );
				if ( Exit.isFailure( decoded ) ) {
					return yield* new MoveNotAllowed( { move: Str.String( move ) } );
				}

				if ( moveData.enabledWhen && !moveData.enabledWhen( acc.work.config ) ) {
					return yield* new MoveNotAllowed( { move: Str.String( move ) } );
				}

				const value = decoded.value as MoveInputs[keyof MoveInputs];

				if ( structure.hooks.beforeMove ) {
					acc.accumulate( ...structure.hooks.beforeMove( acc.getGameData(), playerId, move ) );
				}

				const invalid = moveData.validate( acc.getGameData(), playerId, value );
				if ( invalid ) {
					return yield* invalid;
				}

				// Recorded before the move runs, so `execute` — and the `onResolve` that
				// follows it — read a window that already knows what was just said. On a
				// `first` window that is also what takes everybody else off it.
				acc.accumulate( InteractionResponded.make( {
					frameId: frame.id,
					playerId,
					move: Str.String( move )
				} ) );

				acc.accumulate( ...moveData.execute( acc.getGameData(), playerId, value, rng ) );

				if ( structure.hooks.afterMove ) {
					acc.accumulate( ...structure.hooks.afterMove( acc.getGameData(), playerId, move ) );
				}
			} );


			/**
			 * Every rule a move has to pass, applied to an already-loaded game.
			 *
			 * Two paths, chosen by the position rather than by the caller. With a window
			 * open the move is an answer to it, and the window is the gate. With none
			 * open it is a turn action, and the turn is:
			 * 	- Game should be in progress
			 * 	- The requested move should be defined
			 * 	- Check if move is enabled based on the config
			 * 	- If phased, the current phase should be present
			 * 	- If phased, the move should be allowed in the current phase
			 * 	- Current player should be present
			 * 	- Should be allowed based on the game state
			 * 	- Should pass the final move validation
			 *
			 * A turn action that opens a window does not end its turn there and then.
			 * The tail — the turn advancing, the phase turning over, the game ending — is
			 * held back behind `TurnSuspended` and run by `runInteractionTail` once the
			 * table has finished deciding, so a move cannot be resolved while somebody
			 * still has the right to object to it.
			 *
			 * @param live - The game as it stands.
			 * @param move - The move being played.
			 * @param input - The move's input.
			 * @param actor - Who is playing it.
			 * @param frameId - The window the caller believes they are answering, if any.
			 */
			const applyMove = <K extends keyof MoveInputs>(
				live: LiveGameResident<State, Config, Events>,
				move: K,
				input: MoveInputs[K],
				actor: PlayerId,
				frameId?: string
			) => Effect.gen( function* () {
				const { state, config, context } = live.record;

				yield* assertInProgress( live.record );

				const rng = rngFor( live.record, live.document.cursor );
				const open = activeFrame( live.record.context );

				/** Seals whatever has been accumulated and writes it. */
				const commit = Effect.fn( function* ( acc: Accumulator<State, Config, Events> ) {
					const id = CommitId.make( yield* generator.generateId() );
					const at = yield* Clock.currentTimeMillis;
					const meta = CommitMeta.make( {
						command: "move",
						actor,
						moveType: Str.String( move )
					} );

					return yield* applyCommit( live, seal( acc, { id, at, meta } ) );
				} );

				if ( open ) {
					if ( frameId !== undefined && frameId !== open.id ) {
						return yield* new InteractionStale( { expected: frameId, actual: open.id } );
					}

					// A seat the window is not waiting on is not answering it badly; it is
					// taking a turn the window has suspended, and the refusal says so.
					if ( !open.pending.includes( actor ) ) {
						return yield* new InteractionInProgress( { frameId: open.id, kind: open.kind } );
					}

					const acc = makeAccumulator( live.record );
					yield* respondInto( acc, open, actor, move, input, rng );
					yield* runInteractionTail( acc, rng );

					return yield* commit( acc );
				}

				const moveData = structure.moves[ move ];
				if ( !moveData ) {
					return yield* new MoveNotAllowed( { move: Str.String( move ) } );
				}

				const moveInputSchema = structure.schemas.moves[ move ];
				const result = Schema.decodeUnknownExit( moveInputSchema )( input );
				if ( Exit.isFailure( result ) ) {
					return yield* new MoveNotAllowed( { move: Str.String( move ) } );
				}

				const { canMove, validate, execute, endsTurn, enabledWhen } = moveData;
				if ( enabledWhen && !enabledWhen( live.record.config ) ) {
					return yield* new MoveNotAllowed( { move: Str.String( move ) } );
				}

				if ( structure.phases ) {
					const phase = structure.phases[ live.record.context.phase as keyof PhaseMoves ];
					if ( !phase ) {
						return yield* new PhaseNotFound( { phase: String( live.record.context.phase ) } );
					}

					if ( !phase.moves.includes( move ) ) {
						return yield* new MoveNotAllowed( { move: Str.String( move ) } );
					}
				}

				const currentPlayer = yield* requireCurrentPlayer( live.record );
				const allowed = canMove
					? canMove( { state, config, context }, actor )
					: actor === currentPlayer;

				if ( !allowed ) {
					return yield* new NotYourTurn( { playerId: actor, currentPlayer } );
				}

				const acc = makeAccumulator( live.record );

				if ( structure.hooks.beforeMove ) {
					acc.accumulate( ...structure.hooks.beforeMove( acc.getGameData(), actor, move ) );
				}

				const invalid = validate( acc.getGameData(), actor, input );
				if ( invalid ) {
					return yield* invalid;
				}

				acc.accumulate( ...execute( acc.getGameData(), actor, input, rng ) );

				if ( structure.hooks.afterMove ) {
					acc.accumulate( ...structure.hooks.afterMove( acc.getGameData(), actor, move ) );
				}

				const isTurnEnded = typeof endsTurn === "function"
					? endsTurn( acc.getGameData(), actor, input )
					: endsTurn ?? true;

				if ( activeFrame( acc.work.context ) ) {
					if ( isTurnEnded ) {
						acc.accumulate( TurnSuspended.make( { actor, moveType: Str.String( move ) } ) );
					}

					// Run the tail anyway: a window opened against a table that has nobody
					// left to ask is settled the instant it appears, and would otherwise
					// sit there holding a turn that nothing can release.
					yield* runInteractionTail( acc, rng );

					return yield* commit( acc );
				}

				let nextPhase: keyof PhaseMoves | undefined = undefined;
				if ( isTurnEnded ) {
					nextPhase = yield* runEndTurnTail( acc, actor, move, actor !== currentPlayer );
				}

				const ended = runEndCheck( acc );
				if ( !ended && nextPhase !== undefined ) {
					yield* enterPhase( acc, nextPhase, rng );
				}

				return yield* commit( acc );
			} );


			/**
			 * Asks the game how one seat answers the open window.
			 *
			 * Given exactly what that seat's own client is given — the redacted view,
			 * and the window redacted the same way — so a policy can never reason from
			 * something the player it stands in for cannot see. That matters more here
			 * than it does for `botMove`: a secret window's whole point is that the
			 * other answers are hidden, and a policy handed the unredacted frame would
			 * be playing a different game from everybody else at the table.
			 *
			 * @param record - The current record.
			 * @param frame - The open window.
			 * @param playerId - The seat being answered for.
			 * @returns The response to play, or `undefined` to decline.
			 */
			const askPolicy = (
				record: GameRecord<State, Config>,
				frame: InteractionFrame,
				playerId: PlayerId
			) => {
				if ( !structure.botRespond ) {
					return undefined;
				}

				const { state, config, context } = record;
				const audience = PlayerAudience.make( { playerId } );
				const view = structure.view( { state, config, context }, audience );
				const seen = redactInteractions( context, audience );

				return structure.botRespond(
					{ state: view, config, context: seen },
					frameById( seen, frame.id ) ?? frame
				);
			};


			/**
			 * Asks the game what one seat should play on its turn.
			 *
			 * The counterpart to `askPolicy` above, and given the same thing for the
			 * same reason: the redacted view and the redacted context, so a policy can
			 * never reason from something the player it stands in for cannot see.
			 *
			 * It is a function rather than four lines inside `tick` because `hint`
			 * asks the identical question from the other end — a player wanting to
			 * know what the bot would do with their seat. A hint computed any
			 * differently from the move the bot would actually make would be a lie
			 * about the game, and the only way to be sure of that is for there to be
			 * one place that asks.
			 *
			 * The absent-policy check is belt and braces — both callers have already
			 * looked, because each has something specific to do about it that this
			 * cannot: `tick` bails before it would hand the seat over, and `hint`
			 * refuses with `HintUnavailable` rather than reporting no suggestion.
			 *
			 * @param record - The current record.
			 * @param playerId - The seat whose turn it is.
			 * @returns The move to play, or `undefined` to pass/skip.
			 */
			const askMovePolicy = ( record: GameRecord<State, Config>, playerId: PlayerId ) => {
				if ( !structure.botMove ) {
					return undefined;
				}

				const { state, config, context } = record;
				const audience = PlayerAudience.make( { playerId } );
				const view = structure.view( { state, config, context }, audience );
				const seen = redactInteractions( context, audience );

				return structure.botMove( { state: view, config, context: seen } );
			};


			/**
			 * What the game's own policy would play for one seat.
			 *
			 * The third read on the entity, after `getView` and `subscribe`, and the
			 * only one that is about a single seat rather than about the table: there
			 * is no table-wide hint, because the whole of what this computes is what
			 * *you*, seeing what you see, should do. A stranger is refused rather than
			 * given the redacted answer `getView` would give them.
			 *
			 * Which policy answers depends on the position, the same split `tick`
			 * makes: a window open is a question, and a question is answered by
			 * `botRespond` about that frame; anything else is a turn, and a turn is
			 * answered by `botMove`. Asking while a window is open that is *not*
			 * asking the caller is refused rather than answered about the turn — the
			 * turn is not what is happening, and the hint would be about a position
			 * nobody is in.
			 *
			 * Writes nothing. No commit, no event, no `persist`, so neither `version`
			 * nor `revision` moves and the open subscriptions see no news. That is
			 * deliberate: asking for help changes nothing about the game, and who
			 * asked is the asker's business.
			 *
			 * @param playerId - The seat asking, always the authenticated identity.
			 * @returns The suggestion, whose `move` is absent when the policy declined.
			 */
			const hintFor = Effect.fn( function* ( playerId: PlayerId ) {
				const { record } = yield* requireLive();
				yield* assertMember( record, playerId );
				yield* assertInProgress( record );

				const frame = activeFrame( record.context );
				if ( frame ) {
					if ( !frame.pending.includes( playerId ) ) {
						return yield* Effect.fail(
							new NotRespondingTo( { playerId, frameId: frame.id } )
						);
					}

					if ( !structure.botRespond ) {
						return yield* Effect.fail( new HintUnavailable( { game: structure.name } ) );
					}

					return {
						_tag: "swish/Hint",
						move: askPolicy( record, frame, playerId ),
						frameId: frame.id
					} as const;
				}

				// Through the same helper the move path uses, rather than reading the
				// context directly: a game with no seat to act is not one a hint can be
				// asked about, and `requireCurrentPlayer` is where that already has an
				// answer. Past it there is always somebody to name, so the refusal can
				// tell the client whose turn it actually is.
				const currentPlayer = yield* requireCurrentPlayer( record );
				if ( currentPlayer !== playerId ) {
					return yield* Effect.fail( new NotYourTurn( { playerId, currentPlayer } ) );
				}

				if ( !structure.botMove ) {
					return yield* Effect.fail( new HintUnavailable( { game: structure.name } ) );
				}

				return { _tag: "swish/Hint", move: askMovePolicy( record, playerId ) } as const;
			} );


			/**
			 * The race clock coming due: every machine-played seat that may move out
			 * of turn plays one move, and then they all wait out the delay again.
			 *
			 * Each move is its own commit, written through `applyMove` exactly as if
			 * that seat had sent it — the race is only *when* the bots move, never a
			 * different way of moving. The clock is cleared before the first of them
			 * is written, so the write re-stamps it and the next race is measured from
			 * this one rather than from whenever the clock was first started.
			 *
			 * The same safety argument as the turn clock's: a seat whose policy has
			 * nothing to say, or whose move the rules refuse, writes nothing. If no
			 * seat wrote anything, nothing is armed and the game parks until the next
			 * write from anywhere, rather than asking the same pure policies the same
			 * question every `botDelayMillis` forever.
			 *
			 * @param live - The game as it stands when the clock fired.
			 */
			const tickRace = Effect.fn( function* ( live: LiveGameResident<State, Config, Events> ) {
				const racers = racingSeats( live.record, live.document.runtime );

				let current = produce( live, draft => {
					draft.document.runtime.raceStartedAt = undefined;
				} );

				let moved = false;
				for ( const playerId of racers ) {
					if ( current.record.status !== "IN_PROGRESS" ) {
						break;
					}

					const choice = askMovePolicy( current.record, playerId );
					if ( !choice ) {
						continue;
					}

					const before = current;
					current = yield* applyMove( before, choice.moveType, choice.input, playerId ).pipe(
						Effect.catchCause( cause => Effect.as(
							Effect.logError( "swish: bot policy produced a move the rules refused", cause ),
							before
						) ),
						Effect.annotateLogs( {
							game: structure.name,
							gameId,
							playerId,
							moveType: choice.moveType
						} )
					);

					moved = moved || current !== before;
				}

				if ( !moved ) {
					yield* Effect.logDebug( "swish: no racing seat moved, parking the race clock" );
				}
			} );


			/**
			 * A clock coming due on an open interaction window.
			 *
			 * Two different clocks reach here. The short one is a machine-played
			 * responder having waited out `botDelayMillis`, and answers for exactly one
			 * seat — the next write re-arms, so a table of bots works through a window a
			 * beat at a time instead of all speaking at once. The long one is the
			 * window's own deadline, and settles whoever is left.
			 *
			 * What "settles" means depends on the window. An optional one takes silence
			 * as consent and expires every remaining responder in a single write, which
			 * is the ordinary end of a challenge window nobody wanted to use. A
			 * mandatory one cannot do that — somebody has to give up a card — so it asks
			 * the policy for an answer and only records a timeout when there is nothing
			 * to ask. It works through those one at a time: each commit re-arms against
			 * a deadline already in the past, so the next tick follows immediately and
			 * the loop belongs to the clock rather than to this function.
			 *
			 * Every exit either commits or re-arms. That is the difference from the turn
			 * clock, which is free to park: a window that parked would hold the table
			 * open with nothing left to wake it.
			 *
			 * @param live - The game as it stands.
			 * @param frame - The open window.
			 * @param now - The instant the tick fired.
			 */
			const tickInteraction = Effect.fn( function* (
				live: LiveGameResident<State, Config, Events>,
				frame: InteractionFrame,
				now: number
			) {
				const { record, document } = live;
				const runtime = document.runtime;
				const rng = rngFor( record, document.cursor );

				const windowDeadline = runtime.interactionDeadline;
				const expired = windowDeadline !== undefined && now >= windowDeadline;

				const sealAndApply = Effect.fn( function* (
					acc: Accumulator<State, Config, Events>,
					actor: PlayerId
				) {
					const id = CommitId.make( yield* generator.generateId() );
					const at = yield* Clock.currentTimeMillis;
					const meta = CommitMeta.make( { command: "interaction", actor } );

					yield* applyCommit( live, seal( acc, { id, at, meta } ) );
				} );

				/**
				 * Unwinds what the clock produced, or gives up on the window.
				 *
				 * Nothing is waiting on this the way a caller waits on a command: the
				 * tick sends itself, so a refusal has nowhere to be reported to. Dying
				 * would restart the entity, and activation re-arms straight back into
				 * this same tick — a table that spins instead of one that stops. So a
				 * rules bug is logged and the window is left exactly where it is,
				 * which parks the clock: nothing is written, so nothing re-arms.
				 */
				const settle = ( acc: Accumulator<State, Config, Events>, actor: PlayerId ) =>
					runInteractionTail( acc, rng ).pipe(
						Effect.flatMap( () => sealAndApply( acc, actor ) ),
						Effect.catch( error => Effect.logError(
							"swish: the rules could not settle this window; parking its clock",
							error
						) ),
						Effect.annotateLogs( {
							game: structure.name,
							gameId,
							frameId: frame.id,
							kind: frame.kind
						} )
					);

				if ( expired && frame.allowPass ) {
					const acc = makeAccumulator( record );

					for ( const playerId of frame.pending ) {
						acc.accumulate( InteractionExpired.make( { frameId: frame.id, playerId } ) );
					}

					return yield* settle( acc, frame.initiator );
				}

				const responder = expired
					? frame.pending[ 0 ]
					: frame.pending.find( playerId => isMachinePlayed( record, runtime, playerId ) );

				if ( !responder ) {
					return yield* armAt( document.version, windowDeadline );
				}

				const choice = askPolicy( record, frame, responder );

				// A response the rules refuse is caught rather than allowed to become a
				// defect, for the same reason a refused bot move is: a defect restarts
				// the entity, whose activation re-arms into this same tick. The seat
				// falls through to declining instead, so the window still moves.
				const answered = choice === undefined
					? Option.none<Accumulator<State, Config, Events>>()
					: yield* Effect.gen( function* () {
						const acc = makeAccumulator( record );
						yield* respondInto( acc, frame, responder, choice.moveType, choice.input, rng );
						yield* runInteractionTail( acc, rng );
						return acc;
					} ).pipe(
						Effect.tapCause( cause => Effect.logError(
							"swish: bot policy produced a response the rules refused",
							cause
						) ),
						Effect.option,
						Effect.annotateLogs( {
							game: structure.name,
							gameId,
							playerId: responder,
							frameId: frame.id
						} )
					);

				if ( Option.isSome( answered ) ) {
					return yield* sealAndApply( answered.value, responder );
				}

				const acc = makeAccumulator( record );

				if ( frame.allowPass ) {
					acc.accumulate( InteractionPassed.make( { frameId: frame.id, playerId: responder } ) );
				} else if ( expired ) {
					acc.accumulate( InteractionExpired.make( { frameId: frame.id, playerId: responder } ) );
				} else {
					yield* Effect.logDebug( "swish: no bot response yet, waiting out the window" );
					return yield* armAt( document.version, windowDeadline );
				}

				yield* settle( acc, responder );
			} );


			return SwishEngine.of( {
				initialize: Effect.fn( function* ( { payload: { playerInfo, input } } ) {
					const existing = yield* Ref.get( resident );
					if ( Option.isSome( existing ) ) {
						return;
					}

					const config = { ...structure.defaultConfig(), ...input.config };
					const invalid = validateTeamConfig( config );
					if ( invalid ) {
						return yield* invalid;
					}

					const id = gameId;
					const createdAt = yield* Clock.currentTimeMillis;
					const initialState = structure.setup( config, salt => makeRng( gameId, 0, salt ?? "" ) );
					const runtime = GameRuntime.make( {
						autoPlay: HashSet.make(),
						spectators: {},
						revision: 0
					} );

					const genesis = GenesisSchema.make( { id, createdAt, config, initialState } );
					yield* ledger.createNew( genesis, input.isPrivate ).pipe( Effect.orDie );

					const live = yield* persist( {
						document: DocumentSchema.make( { genesis, log: [], cursor: 0, version: 0, runtime } ),
						record: seedRecord( genesis )
					} );

					const meta = CommitMeta.make( { command: "join", actor: playerInfo.id } );
					yield* seatPlayers( live, [ playerInfo ], meta );
				} ),

				joinGame: Effect.fn( function* ( { payload: { playerInfo } } ) {
					const live = yield* requireLive();

					yield* assertJoinable( live.record );
					yield* assertNotJoined( live.record, playerInfo.id );
					yield* assertHasSeat( live.record );

					const meta = CommitMeta.make( { command: "join", actor: playerInfo.id } );
					yield* seatPlayers( live, [ playerInfo ], meta );
				} ),

				spectate: Effect.fn( function* ( { payload: { playerInfo } } ) {
					const live = yield* requireLive();

					if ( live.record.players[ playerInfo.id ] ) {
						return yield* new AlreadyJoined( { playerId: playerInfo.id } );
					}

					if ( live.document.runtime.spectators[ playerInfo.id ] ) {
						return;
					}

					yield* persist(
						produce( live, draft => {
							draft.document.runtime.spectators[ playerInfo.id ] = playerInfo;
						} )
					);

					yield* ledger.createSpectator( gameId, playerInfo );
				} ),

				addBots: Effect.fn( function* ( { payload: { playerInfo } } ) {
					const live = yield* requireLive();

					yield* assertMember( live.record, playerInfo.id );
					yield* assertJoinable( live.record );

					const seats = live.record.config.playerCount - Object.keys( live.record.players ).length;

					const bots = yield* Effect.forEach(
						Array.from( { length: Math.max( 0, seats ) } ),
						Effect.fn( function* () {
							const id = yield* generator.generateId();
							return PlayerInfo.make( {
								id: PlayerId.make( id ),
								name: yield* generator.generateName( id ),
								avatar: yield* generator.generateAvatar( id ),
								isBot: true
							} );
						} )
					);

					const meta = CommitMeta.make( { command: "addBots", actor: playerInfo.id } );
					yield* seatPlayers( live, bots, meta );
				} ),

				joinTeam: Effect.fn( function* ( { payload: { playerInfo, input } } ) {
					const live = yield* requireLive();

					yield* assertMember( live.record, playerInfo.id );

					const teams = yield* requireTeams( structure.name, live.record.config );
					if ( !teams.includes( input.team ) ) {
						return yield* new TeamNotFound( { team: input.team } );
					}

					const context = live.record.context;
					if ( context.teams[ playerInfo.id ] === input.team ) {
						return;
					}

					const perSide = live.record.config.playerCount / teams.length;
					const taken = Object.values( context.teams )
						.filter( team => team === input.team ).length;

					if ( taken >= perSide ) {
						return yield* new TeamFull( { team: input.team, size: perSide } );
					}

					const meta = CommitMeta.make( { command: "joinTeam", actor: playerInfo.id } );
					yield* commitWith( live, meta, ( acc ) => Effect.sync(
						() => acc.accumulate(
							TeamAssigned.make( { playerId: playerInfo.id, team: input.team } )
						)
					) );
				} ),

				nameTeam: Effect.fn( function* ( { payload: { playerInfo, input } } ) {
					const live = yield* requireLive();

					yield* assertMember( live.record, playerInfo.id );

					const teams = yield* requireTeams( structure.name, live.record.config );
					if ( !teams.includes( input.team ) ) {
						return yield* new TeamNotFound( { team: input.team } );
					}

					const context = live.record.context;
					if ( context.teams[ playerInfo.id ] !== input.team ) {
						return yield* new NotOnTeam( { playerId: playerInfo.id, team: input.team } );
					}

					const existing = context.teamNames[ input.team ];
					if ( existing ) {
						return yield* new TeamAlreadyNamed( { team: input.team, name: existing } );
					}

					const meta = CommitMeta.make( { command: "nameTeam", actor: playerInfo.id } );
					yield* commitWith( live, meta, ( acc ) => Effect.sync(
						() => acc.accumulate(
							TeamNamed.make( { team: input.team, name: TeamName.make( input.name ) } )
						) )
					);
				} ),

				leaveTeam: Effect.fn( function* ( { payload: { playerInfo } } ) {
					const live = yield* requireLive();

					yield* assertMember( live.record, playerInfo.id );
					yield* requireTeams( structure.name, live.record.config );

					if ( !live.record.context.teams[ playerInfo.id ] ) {
						return;
					}

					const meta = CommitMeta.make( { command: "leaveTeam", actor: playerInfo.id } );
					yield* commitWith( live, meta, ( acc ) => Effect.sync( () =>
						acc.accumulate( TeamLeft.make( { playerId: playerInfo.id } ) )
					) );
				} ),

				/**
				 * Plays the same people again.
				 *
				 * There is one rematch per game, and this is where that is made true:
				 * the entity handles one command at a time, so a whole table pressing
				 * the button at once queues up behind the first, which is the one that
				 * builds the table. Everybody after it is answered with what it made.
				 *
				 * The reference is recorded *after* the next table exists, so a failure
				 * on the way there leaves nothing pointing at a game nobody can open.
				 */
				rematch: Effect.fn( function* ( { payload: { playerInfo, input } } ) {
					const live = yield* requireLive();

					yield* assertMember( live.record, playerInfo.id );

					const existing = live.document.runtime.rematch;
					if ( existing ) {
						return existing;
					}

					if ( live.record.status !== "COMPLETED" ) {
						return yield* new RematchUnavailable( { status: live.record.status } );
					}

					const { players, context, config } = live.record;
					const plan = rematchPlanFor(
						RematchSource.make( { players, context, config } ),
						input.keepTeams
					);

					const nextId = GameId.make( yield* generator.generateId() );

					// Private, and not because anything is being hidden: the table is
					// full the moment it exists, so there is no seat the lobby could
					// offer anybody and nothing for it to list.
					const initialize = InitializeInputSchema.make( {
						id: nextId,
						config,
						isPrivate: true
					} );

					// A delivery failure is infrastructure rather than a refusal, and is
					// treated as one everywhere else a client call is made.
					yield* dieOnClusterError( clientFor( nextId ).inherit( {
						input: initialize,
						plan,
						rematchOf: gameId
					} ) );

					const ref = GameRef.make( { gameId: nextId } );
					yield* persist( produce( live, draft => {
						draft.document.runtime.rematch = ref;
					} ) );

					return ref;
				} ),

				/**
				 * Lays this table out as another game's rematch.
				 *
				 * The sides are written before anybody is seated, which is the whole
				 * reason this is one command rather than an initialize and a run of
				 * joins: `seatPlayers` starts a table that `autoStart` asked to start
				 * itself, so a side assigned after the last seat is a side assigned
				 * after the game began. `TeamAssigned` names a player rather than a
				 * member, so writing it first costs nothing and `start` finds every
				 * seat already placed.
				 */
				inherit: Effect.fn( function* ( { payload: { input, plan, rematchOf } } ) {
					const existing = yield* Ref.get( resident );
					if ( Option.isSome( existing ) ) {
						return;
					}

					const invalid = validateTeamConfig( input.config );
					if ( invalid ) {
						return yield* invalid;
					}

					const createdAt = yield* Clock.currentTimeMillis;
					const initialState = structure.setup(
						input.config,
						salt => makeRng( gameId, 0, salt ?? "" )
					);

					const runtime = GameRuntime.make( {
						autoPlay: HashSet.make(),
						spectators: {},
						revision: 0
					} );

					const genesis = GenesisSchema.make( {
						id: gameId,
						createdAt,
						config: input.config,
						initialState
					} );

					yield* ledger.createNew( genesis, input.isPrivate, rematchOf ).pipe( Effect.orDie );

					const live = yield* persist( {
						document: DocumentSchema.make( { genesis, log: [], cursor: 0, version: 0, runtime } ),
						record: seedRecord( genesis )
					} );

					const host = plan.players[ 0 ];
					if ( !host ) {
						return;
					}

					const seated = plan.teams.length === 0
						? live
						: yield* commitWith(
							live,
							CommitMeta.make( { command: "joinTeam", actor: host.id } ),
							( acc ) => Effect.sync( () => {
								for ( const side of plan.teams ) {
									acc.accumulate( TeamNamed.make( { team: side.team, name: side.name } ) );

									for ( const playerId of side.members ) {
										acc.accumulate( TeamAssigned.make( { playerId, team: side.team } ) );
									}
								}
							} )
						);

					const meta = CommitMeta.make( { command: "join", actor: host.id } );
					yield* seatPlayers( seated, plan.players, meta );
				} ),

				startGame: Effect.fn( function* ( { payload: { playerInfo } } ) {
					const live = yield* requireLive();

					yield* assertMember( live.record, playerInfo.id );
					yield* assertCanStart( live.record );

					yield* startGame( live, playerInfo.id );
				} ),

				undo: Effect.fn( function* ( { payload: { playerInfo } } ) {
					const live = yield* requireLive();

					yield* assertMember( live.record, playerInfo.id );
					yield* assertNoOpenInteraction( live.record );

					const cursor = live.document.cursor;
					const target = cursor > 0 ? live.document.log[ cursor - 1 ] : undefined;

					if ( live.record.status === "COMPLETED" ) {
						return yield* new UndoNotAllowed( { playerId: playerInfo.id, cursor } );
					}

					if ( !target || target.meta.command !== "move" ) {
						return yield* new NothingToUndo( { cursor } );
					}

					if ( target.meta.actor !== playerInfo.id ) {
						return yield* new UndoNotAllowed( { playerId: playerInfo.id, cursor } );
					}

					const document = produce( live.document, draft => {
						draft.cursor--;
						draft.version++;
					} );

					yield* persist( { document, record: foldDocument( document ) } );
				} ),

				redo: Effect.fn( function* ( { payload: { playerInfo } } ) {
					const live = yield* requireLive();

					yield* assertMember( live.record, playerInfo.id );
					yield* assertNoOpenInteraction( live.record );

					const cursor = live.document.cursor;
					const target = live.document.log[ cursor ];

					if ( !target ) {
						return yield* new NothingToRedo( { cursor } );
					}

					if ( target.meta.actor !== playerInfo.id ) {
						return yield* new RedoNotAllowed( { playerId: playerInfo.id, cursor } );
					}

					// Assembled rather than drafted, for the reason `applyCommit` spells
					// out: the re-folded record is already a new value, and drafting it
					// into the document would leave a proxy behind in what is stored.
					const folded = foldEvents( live.record, target.events, structure.apply );
					const record = { ...folded, version: folded.version + 1 };

					yield* persist( {
						record,
						document: {
							...live.document,
							cursor: cursor + 1,
							version: record.version
						}
					} );
				} ),


				autoPlay: Effect.fn( function* ( { payload: { playerInfo, input } } ) {
					const live = yield* requireLive();

					yield* assertMember( live.record, playerInfo.id );

					// Either policy is enough to hand a seat over. A game with only
					// `botRespond` cannot take the seat's turns, but it can answer the
					// windows the seat is asked — and being answered for while a window
					// holds the table up is most of what handing a seat over is for.
					if ( !policies.botMove && !policies.botRespond ) {
						return yield* new AutoPlayUnavailable( { game: structure.name } );
					}

					yield* persist(
						produce( live, draft => {
							draft.document.runtime.autoPlay = input.enabled
								? HashSet.add( live.document.runtime.autoPlay, playerInfo.id )
								: HashSet.remove( live.document.runtime.autoPlay, playerInfo.id );
						} )
					);
				} ),

				submitMove: Effect.fn( function* ( { payload: { playerInfo, ...payload } } ) {
					const live = yield* requireLive();
					yield* assertMember( live.record, playerInfo.id );

					const move = payload.move as keyof MoveInputs;

					// The name arrived off the wire, so it may be one this game has never
					// heard of. Checked before the decode rather than left to `applyMove`,
					// which does check it: the lookup below is keyed by that same name, and
					// a schema that came back `undefined` would be handed to the decoder
					// and throw — a defect, which restarts the entity and redelivers this
					// very command.
					const moveInputSchema = structure.schemas.moves[ move ];
					if ( !moveInputSchema ) {
						return yield* new MoveNotAllowed( { move: payload.move } );
					}

					const input = Schema.decodeUnknownOption( moveInputSchema )( payload.input );
					if ( Option.isNone( input ) ) {
						return yield* new MoveNotAllowed( { move: payload.move } );
					}

					yield* applyMove(
						live,
						move,
						input.value as MoveInputs[keyof MoveInputs],
						playerInfo.id,
						payload.frameId
					);
				} ),

				/**
				 * Declining the open window.
				 *
				 * One seat's answer, never the table's: the caller comes off `pending`
				 * and the window stays open for everybody else, which is what makes "no
				 * objection" a thing each opponent says for themselves. A window that
				 * settles on this pass is closed and resolved by the same tail a response
				 * runs, so a decision nobody objected to reaches `onResolve` exactly the
				 * way a contested one does.
				 */
				pass: Effect.fn( function* ( { payload: { playerInfo, input } } ) {
					const live = yield* requireLive();

					yield* assertMember( live.record, playerInfo.id );
					yield* assertInProgress( live.record );

					const frame = yield* requireActiveFrame( live.record, playerInfo.id, input.frameId );

					if ( !frame.allowPass ) {
						return yield* new PassNotAllowed( { frameId: frame.id, kind: frame.kind } );
					}

					const rng = rngFor( live.record, live.document.cursor );
					const acc = makeAccumulator( live.record );

					acc.accumulate( InteractionPassed.make( {
						frameId: frame.id,
						playerId: playerInfo.id
					} ) );

					yield* runInteractionTail( acc, rng );

					const id = CommitId.make( yield* generator.generateId() );
					const at = yield* Clock.currentTimeMillis;
					const meta = CommitMeta.make( { command: "pass", actor: playerInfo.id } );

					yield* applyCommit( live, seal( acc, { id, at, meta } ) );
				} ),


				/**
				 * The turn clock coming due: the bot answers for the seat, or the seat is
				 * taken off the player holding it and handed to the bot for good.
				 *
				 * Every way out of here that changes nothing also arms nothing, and that
				 * is the whole safety argument. A policy with no answer is pure in the
				 * position, so re-arming would ask it the same question forever; a move
				 * the rules refuse leaves no commit, so re-arming would replay the same
				 * refusal every `botDelayMillis`. Both park the game instead, and the next
				 * write from any source — somebody moving, somebody taking a move back,
				 * a seat being handed over — winds the clock again through `persist`.
				 *
				 * A table of bots plays itself out through the other exit: each tick
				 * commits, `persist` re-arms against the new position, and the run ends on
				 * the commit carrying `GameCompleted`. After it the game is no longer in
				 * progress, no clock applies, and that same `persist` puts the timer away.
				 */
				tick: Effect.fn( function* ( { payload: { version } } ) {
					const current = yield* Ref.get( resident );
					if ( Option.isNone( current ) ) {
						return;
					}

					const live = current.value;
					const { record, document } = live;

					if ( document.version !== version ) {
						return;
					}

					const wake = wakeAt( live );
					if ( wake === undefined ) {
						return;
					}

					// Woken early, or the seat was taken back while the clock was running.
					// Re-arming here sleeps a strictly positive remainder, so it cannot
					// tighten into a loop the way the other exits could.
					const now = yield* Clock.currentTimeMillis;
					if ( now < wake ) {
						return yield* armTimer( live );
					}

					const frame = activeFrame( record.context );
					if ( frame ) {
						return yield* tickInteraction( live, frame, now );
					}

					// One clock per tick. If the turn clock is also due it is still due
					// after the race has written, and the re-arm that write makes fires
					// straight away.
					const { raceStartedAt } = document.runtime;
					const { botDelayMillis } = record.config;
					if ( raceStartedAt !== undefined
						&& botDelayMillis !== undefined
						&& now >= raceStartedAt + botDelayMillis ) {
						return yield* tickRace( live );
					}

					const deadline = document.runtime.deadline;
					if ( deadline === undefined || now < deadline ) {
						return;
					}

					const currentPlayer = record.context.currentPlayer;
					if ( !structure.botMove || !currentPlayer ) {
						return;
					}

					if ( !isMachinePlayed( record, document.runtime, currentPlayer ) ) {
						yield* persist( produce( live, draft => {
							draft.document.runtime.autoPlay = HashSet.add(
								document.runtime.autoPlay,
								currentPlayer
							);
						} ) );

						return;
					}

					// Through `askMovePolicy` rather than inline, so the move played here
					// and the move `hint` reports are computed by one piece of code. It
					// hands the policy the redacted view, not the record — a policy is
					// given exactly what the seat's own client is given, and tictactoe's
					// reads `playerId`, which only a `PlayerAudience` fills in.
					const choice = askMovePolicy( record, currentPlayer );
					if ( !choice ) {
						return yield* Effect.logDebug( "swish: bot policy passed, parking the turn clock" );
					}

					// Caught rather than allowed to become a defect: a defect restarts the
					// entity, whose activation re-arms into this same tick and this same
					// defect, rate-limited into a restart loop rather than stopped.
					yield* applyMove( live, choice.moveType, choice.input, currentPlayer ).pipe(
						Effect.catchCause( cause => Effect.logError(
							"swish: bot policy produced a move the rules refused",
							cause
						) ),
						Effect.annotateLogs( {
							game: structure.name,
							gameId,
							playerId: currentPlayer,
							moveType: choice.moveType
						} )
					);
				} ),

				getView: ( { payload: { playerInfo } } ) => viewFor( playerInfo.id ),

				hint: ( { payload: { playerInfo } } ) => hintFor( playerInfo.id ),

				/**
				 * The player's view now, and again after every commit that changes it.
				 *
				 * Each change is answered by re-reading the live record rather than by
				 * projecting what the event carried, so a client that misses a beat is
				 * still handed the current position rather than a replay of an old one.
				 *
				 * The check is on `revision`, not `version`, because a write that commits
				 * nothing still changes what a client is looking at: a seat handed to the
				 * bot policy, and the deadline that moves with it, leave `version` exactly
				 * where it was.
				 *
				 * The same view is also re-sent every 10s while nothing happens,
				 * so the connection never sits silent long enough to be
				 * mistaken for a dead one. The heartbeat is merged *after* the
				 * check, since its whole point is to repeat a view that has not changed.
				 */
				subscribe: ( { payload: { playerInfo } } ) => Rpc.fork(
					Stream.unwrap( Effect.gen( function* () {
						const changes = yield* PubSub.subscribe( hub );
						const opening = yield* viewFor( playerInfo.id );

						const commits = Stream.fromSubscription( changes ).pipe(
							Stream.mapEffect( () => viewFor( playerInfo.id ) ),
							Stream.prepend( [ opening ] ),
							Stream.changesWith( ( a, b ) => a.runtime.revision === b.runtime.revision )
						);

						const heartbeatSchedule = Schedule.spaced( Duration.seconds( 10 ) );
						const heartbeat = Stream.fromSchedule( heartbeatSchedule ).pipe(
							Stream.mapEffect( () => viewFor( playerInfo.id ) )
						);

						return Stream.merge( commits, heartbeat );
					} ) )
				)
			} );
		} )
	);

	const Engine = Effect.gen( function* () {
		const generator = yield* Generator;
		const getClient = yield* SwishEngine.client;

		return {
			createGame: ( { isPrivate, ...payload }: Partial<Config> & { isPrivate: boolean } ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const gameId = GameId.make( yield* generator.generateId() );
					const config = { ...structure.defaultConfig(), ...payload };
					const input = InitializeInputSchema.make( { id: gameId, config, isPrivate } );

					const client = getClient( gameId );
					yield* dieOnClusterError( client.initialize( { playerInfo, input } ) );

					return GameRef.make( { gameId } );
				} ),

			joinGame: ( params: GameRef ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					yield* dieOnClusterError( client.joinGame( { playerInfo } ) );
				} ),

			spectate: ( params: GameRef ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					yield* dieOnClusterError( client.spectate( { playerInfo } ) );
				} ),

			addBots: ( params: GameRef ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					yield* dieOnClusterError( client.addBots( { playerInfo } ) );
				} ),

			joinTeam: ( params: GameRef, input: JoinTeamInput ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					yield* dieOnClusterError( client.joinTeam( { playerInfo, input } ) );
				} ),

			nameTeam: ( params: GameRef, input: NameTeamInput ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					yield* dieOnClusterError( client.nameTeam( { playerInfo, input } ) );
				} ),

			leaveTeam: ( params: GameRef ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					yield* dieOnClusterError( client.leaveTeam( { playerInfo } ) );
				} ),

			startGame: ( params: GameRef ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					yield* dieOnClusterError( client.startGame( { playerInfo } ) );
				} ),

			rematch: ( params: GameRef, input: RematchInput ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					return yield* dieOnClusterError( client.rematch( { playerInfo, input } ) );
				} ),

			undo: ( params: GameRef ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					yield* dieOnClusterError( client.undo( { playerInfo } ) );
				} ),

			redo: ( params: GameRef ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					yield* dieOnClusterError( client.redo( { playerInfo } ) );
				} ),

			autoPlay: ( params: GameRef, input: AutoPlayInput ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					yield* dieOnClusterError( client.autoPlay( { playerInfo, input } ) );
				} ),

			pass: ( params: GameRef, input: PassInteractionInput ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					yield* dieOnClusterError( client.pass( { playerInfo, input } ) );
				} ),

			getView: ( params: GameRef ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					return yield* dieOnClusterError( client.getView( { playerInfo } ) );
				} ),

			hint: ( params: GameRef ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					return yield* dieOnClusterError( client.hint( { playerInfo } ) );
				} ),

			subscribe: ( params: GameRef ) =>
				( user: SwishUser ) => {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					return dieOnClusterErrorStream( client.subscribe( { playerInfo } ) );
				},

			submitMove: <K extends keyof MoveInputs>( move: K, params: GameRef, input: MoveInputs[K] ) =>
				Effect.fn( function* ( user: SwishUser ) {
					const playerInfo = toPlayerInfo( user );
					const client = getClient( params.gameId );
					yield* dieOnClusterError(
						client.submitMove( { move: String( move ), playerInfo, input } )
					);
				} )
		};
	} );

	return { EngineLive: SwishEngineLive, Engine, Structure: structure };
};
