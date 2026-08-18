import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { generateBotInfo, generateId, generateTeamName } from "@/shared/utils/generator.ts";
import { hashSeed, makeRng } from "@/shared/utils/rng.ts";
import { SwishArchive, SwishStorage, SwishSync, SwishTimers } from "@/swish/server/services.ts";
import { Accumulator } from "@/swish/server/utils.ts";
import {
	ArchivedGame,
	AutoPlayUnavailable,
	CannotStart,
	CorruptState,
	CurrentPlayerSet,
	EventsCommit,
	GameCompleted,
	GameContext,
	GameFull,
	GameId,
	GameNotFound,
	GameNotInProgress,
	GameNotJoinable,
	GameRecord,
	GameRef,
	GameView,
	InteractionOpened,
	InteractionResolved,
	InteractionResponded,
	InvalidMove,
	InvalidTeamName,
	MoveNotAllowed,
	NotAMember,
	NothingToRedo,
	NothingToUndo,
	NotYourTurn,
	PhaseEntered,
	PhaseExited,
	PhaseNotFound,
	PlayerAudience,
	PlayerId,
	PlayerInfo,
	PlayerJoined,
	RedoNotAllowed,
	ResultsResolved,
	SeatOrderSet,
	StatusChanged,
	TableAudience,
	TeamAssigned,
	TeamName,
	TeamNamed,
	TurnAdvanced,
	UndoNotAllowed
} from "@/swish/shared/schema.ts";
import {
	balanceTeams,
	interleaveSeats,
	nameOf,
	refuseName,
	refuseTeam,
	teamOf,
	validateTeamConfig,
	withTeamStandings
} from "@/swish/shared/teams.ts";

import type { GameStructure } from "@/swish/server/structure.ts";
import type {
	Audience,
	BaseGameConfig,
	BaseGameEvent,
	CommitMeta,
	InitializeInput,
	TeamId
} from "@/swish/shared/schema.ts";

const BOT_DELAY_MS = 5000;
const AUTO_START_DELAY_MS = 5000;

/** How soon a seat plays once a timeout hands it to the bot policy. */
const TIMED_OUT_DELAY_MS = 0;

const RESERVED_COMMANDS = [
	"initialize",
	"join",
	"joinTeam",
	"nameTeam",
	"addBots",
	"start",
	"cleanup",
	"undo",
	"redo",
	"alarm",
	"getState",
	"setAutoPlay"
];

/**
 * Builds a game's runtime from its declarative `GameStructure`.
 * Yields the command surface a host drives the game through -
 * - Lifecycle: initialize, join, addBots, start, cleanup
 * - Play: one command per move the structure declares
 * - History: undo, redo
 * - Reads: getState
 * - Host callback: alarm
 *
 * Throws while being constructed if the game is named `swish`, or if a move is
 * named after an engine command, since either would shadow the engine.
 *
 * @typeParam Name - The game's unique name; half of the `GameAddress` the host services take.
 * @typeParam State - The game-owned state shape (opaque to the engine).
 * @typeParam Config - The game config, extending `BaseGameConfig`.
 * @typeParam MoveInputs - Map of move name → input schema.
 * @typeParam PhaseMoves - Map of phase name → the move names legal in it.
 * @typeParam Events - The game's domain event union.
 * @typeParam View - The redacted game info built for one audience
 * @param structure - The game's declarative contract.
 * @returns The game's command surface, once the host services are provided.
 */
export const makeEngine = <
	Name extends string,
	State,
	Config extends BaseGameConfig,
	MoveInputs extends Record<string, Schema.Top>,
	PhaseMoves extends Record<string, ReadonlyArray<keyof MoveInputs>>,
	Events extends BaseGameEvent,
	View
>(
	structure: GameStructure<Name, State, Config, MoveInputs, PhaseMoves, Events, View>
) => {
	type GameEventsCommit = typeof GameEventsCommit.Type;
	const GameEventsCommit = EventsCommit( structure.schemas.events );

	const RecordSchema = GameRecord( structure.schemas.state, structure.schemas.config );
	const ViewSchema = GameView( structure.schemas.view, structure.schemas.config );
	const ArchiveSchema = ArchivedGame( structure.schemas.view, structure.schemas.config );

	if ( structure.name === "swish" ) {
		throw new Error( "A game cannot be named \"swish\": its event tags collide with the engine's." );
	}

	const collisions = Object.keys( structure.moves )
		.filter( move => RESERVED_COMMANDS.includes( move ) );

	if ( collisions.length > 0 ) {
		throw new Error(
			`Moves may not be named after engine commands: ${ collisions.join( ", " ) }`
		);
	}

	/**
	 * Whether a player's seat may still act. A seat with no recorded status is
	 * active; folded, eliminated and out seats are barred from moving.
	 *
	 * @param context - The context holding the seat map.
	 * @param playerId - The player whose seat is being checked.
	 * @returns `true` if the seat is still active.
	 */
	const isSeatActive = ( context: GameContext, playerId: PlayerId ) => {
		const status = context.seats[ playerId ];
		return status === undefined || status === "active";
	};

	/**
	 * The engine's default turn order: the next active seat after the player who
	 * just acted, wrapping around and skipping seats that are no longer active.
	 * Used only when a flat game declares no `resolveNextPlayer`.
	 *
	 * @param context - The context holding the seating order.
	 * @param from - The player who just acted.
	 * @returns The next active player, or `undefined` when none remain.
	 */
	const nextActiveSeat = ( context: GameContext, from: PlayerId ) => {
		const order = context.players;
		const start = order.indexOf( from );

		for ( let i = 1; i <= order.length; i++ ) {
			const candidate = order[ ( start + i ) % order.length ];
			if ( candidate && isSeatActive( context, candidate ) ) {
				return candidate;
			}
		}

		return undefined;
	};

	/**
	 * Redacts a record for one audience.
	 *
	 * @param data - The record to project.
	 * @param audience - Who the view is for.
	 * @returns The view that audience may see.
	 */
	const viewFor = ( { state, config, context }: GameRecord<State, Config>, audience: Audience ) =>
		structure.view( { state, config, context }, audience );

	/**
	 * Projects a record into every audience's view: the shared table view plus
	 * one redacted view per seated player.
	 *
	 * @param data - The record to project.
	 * @returns The table view and the view for each player.
	 */
	const buildViews = ( data: GameRecord<State, Config> ) => {
		const tableView = viewFor( data, TableAudience.make( {} ) );
		const playerViews = data.context.players.reduce(
			( views, pid ) => {
				views[ pid ] = viewFor( data, PlayerAudience.make( { playerId: pid } ) );
				return views;
			},
			{} as Record<PlayerId, View>
		);

		return { tableView, playerViews };
	};

	/**
	 * How long a frame of this kind stays open: the interaction's own override,
	 * else the game-wide config. Neither set means the frame never expires.
	 *
	 * @param kind - The interaction kind being opened.
	 * @param config - The game config.
	 * @returns The frame's lifetime in millis, or `undefined` when it has none.
	 */
	const interactionTimeout = ( kind: string, config: Config ) =>
		structure.interactions?.[ kind ]?.timeoutMillis ?? config.interactionTimeoutMillis;

	/**
	 * Whether an event is the engine's own "a reaction window opened".
	 *
	 * @param event - Any event a game or the engine produced.
	 * @returns `true` when the event carries a frame.
	 */
	const isInteractionOpened = (
		event: { readonly _tag: string }
	): event is InteractionOpened =>
		event._tag === "swish/ev/InteractionOpened";

	/**
	 * Stamps an absolute `deadline` onto every frame a command opens, since a
	 * game's `execute` has no clock of its own. The deadline lands *in the event*,
	 * so a replay folds the same value instead of recomputing a new one — the same
	 * reason a move's randomness is safe. A deadline the game set itself is kept.
	 *
	 * @param events - The events a move or resolution produced.
	 * @param config - The game config supplying the fallback timeout.
	 * @param now - The command's timestamp.
	 * @returns The same events, with frame deadlines filled in.
	 */
	const stampDeadlines = <E extends { readonly _tag: string }>(
		events: ReadonlyArray<E>,
		config: Config,
		now: number
	) => events.map( event => {
		if ( !isInteractionOpened( event ) || event.frame.deadline !== undefined ) {
			return event;
		}

		const timeout = interactionTimeout( event.frame.kind, config );
		return timeout === undefined
			? event
			: InteractionOpened.make( { frame: { ...event.frame, deadline: now + timeout } } );
	} );

	return Effect.gen( function* () {
		const storage = yield* SwishStorage;
		const archive = yield* SwishArchive;
		const sync = yield* SwishSync;
		const timers = yield* SwishTimers;

		/**
		 * Rebuilds the record by folding the commit log up to a cursor. This is how
		 * undo and redo travel the log, and how `load` heals a record that has
		 * drifted from the cursor.
		 *
		 * The fold starts at the newest checkpoint the store has at or before the
		 * cursor, falling back to the base record when there is none, so the number
		 * of commits replayed is bounded by the checkpoint interval rather than by
		 * the game's length. A gap in the commits below the cursor is corruption:
		 * the log is contiguous by construction.
		 *
		 * @param [target] - The cursor to rebuild at. Defaults to the current one.
		 * @returns The game as of that cursor, stamped with the matching version.
		 */
		const refold = Effect.fn( function* ( target?: number ) {
			const current = yield* storage.readCursor();
			const cursor = target ?? current;

			const checkpoint = yield* storage.nearestCheckpoint<GameRecord<State, Config>>( cursor );
			const start = checkpoint
				? checkpoint.data
				: yield* storage.readBase<GameRecord<State, Config>>();

			if ( !start ) {
				return yield* new CorruptState( {
					id: GameId.make( "unkown" ),
					reason: "Base not set!"
				} );
			}

			const accumulator = new Accumulator( start, structure.apply );

			for ( let index = ( checkpoint?.index ?? -1 ) + 1; index <= cursor; index++ ) {
				const commit = yield* storage.readCommit<GameEventsCommit>( index );
				if ( !commit ) {
					return yield* new CorruptState( {
						id: start.id,
						reason: `Commit ${ index } is missing from the log.`
					} );
				}

				accumulator.accumulate( ...commit.events );
			}

			return { ...accumulator.work, version: cursor + 1 };
		} );

		/**
		 * Reads the materialized record, refolding it from the log when its
		 * version disagrees with the cursor. Every command starts here.
		 *
		 * @returns The game's current record.
		 */
		const load = Effect.fn( function* () {
			const data = yield* storage.readRecord<GameRecord<State, Config>>();
			if ( !data ) {
				return yield* new GameNotFound( {} );
			}

			const cursor = yield* storage.readCursor();
			if ( data.version === cursor + 1 ) {
				return data;
			}

			const healed = yield* refold();
			yield* storage.writeRecord( healed );

			return healed;
		} );

		/**
		 * Builds the wire envelope for one audience: the record minus its seed and
		 * state, plus the view that audience may see and the engine's two
		 * scheduling facts. Autoplay comes from the store and the deadline from the
		 * timers, since neither is folded state, and every `GameView` carries them
		 * whether it was pushed or fetched.
		 *
		 * @param data - The record to project.
		 * @returns A function turning one audience's view into its envelope.
		 */
		const envelopeFor = Effect.fn( function* ( data: GameRecord<State, Config> ) {
			const autoPlay = yield* storage.readAutoPlay();
			const deadline = yield* timers.deadline();
			const { state, config, seed, ...header } = data;

			return ( view: View ) =>
				ViewSchema.make( { ...header, view, config, autoPlay, deadline } );
		} );

		/**
		 * Where this game lives, as far as the host services are concerned.
		 *
		 * @param data - The record being addressed.
		 * @returns The game's address for fan-out and the archive.
		 */
		const addressOf = ( data: GameRecord<State, Config> ) =>
			( { game: structure.name, id: data.id } );

		/**
		 * Pushes fresh state to everyone watching: the table's view and each
		 * player's own, as one payload. All of them go out as the same `GameView`
		 * envelope a read returns, so a client decodes one shape however it
		 * arrived. The seed is stripped on the way out, since it would let a client
		 * reconstruct hidden state.
		 *
		 * @param data - The record to publish.
		 */
		const broadcastState = Effect.fn( function* ( data: GameRecord<State, Config> ) {
			const { tableView, playerViews } = buildViews( data );
			const envelope = yield* envelopeFor( data );

			yield* sync.publish( {
				table: envelope( tableView ),
				players: Object.fromEntries(
					Object.entries( playerViews ).map( ( [ pid, view ] ) => [ pid, envelope( view ) ] )
				) as Record<PlayerId, GameView<View, Config>>
			} );
		} );

		/**
		 * Who the engine is waiting on: the next responder yet to answer while an
		 * interaction is open, otherwise the current player.
		 *
		 * @param data - The record to inspect.
		 * @returns The player expected to act, if there is one.
		 */
		const pendingActor = ( data: GameRecord<State, Config> ) => {
			if ( data.context.interactions.length > 0 ) {
				const [ active ] = data.context.interactions.slice( -1 );
				return active.responders.find( ( id ) => !( id in active.responses ) );
			}

			return data.context.currentPlayer;
		};

		/**
		 * Whether a seat is played by the machine rather than by a person — a bot,
		 * or a human who handed their seat to the bot policy. The two are one case
		 * everywhere the engine schedules or acts, so they are asked as one question.
		 *
		 * A game that declares no `botMove` has no machine to play *any* seat, so
		 * this is false throughout one: the alternative is arming a bot alarm that
		 * fires into nothing while no other timer is pending, which strands the
		 * table permanently. A bot seat in such a game falls back to the move clock
		 * and is skipped like any other seat that will not act.
		 *
		 * @param data - The record holding the roster.
		 * @param autoPlay - The seats currently on autoplay.
		 * @param playerId - The seat being checked.
		 * @returns `true` when `botMove` should play this seat.
		 */
		const actsAutomatically = (
			data: GameRecord<State, Config>,
			autoPlay: Record<PlayerId, boolean>,
			playerId: PlayerId
		) => structure.botMove !== undefined
			&& ( data.players[ playerId ]?.isBot === true || autoPlay[ playerId ] );

		/**
		 * Works out which clocks the coming turn runs under and hands the whole set
		 * to the timers in one call, which is what drops whatever was pending: a
		 * command never leaves a stale clock behind, and undo/redo land on a fresh
		 * one rather than a rewound one.
		 *
		 * The pending seat gets exactly one clock — the bot delay when the machine
		 * plays it, otherwise the move clock, whose deadline the timers publish so
		 * the seat's client can count it down. An open frame runs its own expiry
		 * alongside either, since the frame outlives whichever responder the engine
		 * is waiting on. A game nobody is waiting on runs no clocks at all.
		 *
		 * Must run before the state it arms for is broadcast, or the envelope
		 * carries the previous turn's clock.
		 *
		 * @param data - The record the next actor will act on.
		 */
		const armTimers = Effect.fn( function* ( data: GameRecord<State, Config> ) {
			const actorId = data.status === "IN_PROGRESS" ? pendingActor( data ) : undefined;
			if ( !actorId ) {
				return yield* timers.rearm( {} );
			}

			const [ frame ] = data.context.interactions.slice( -1 );
			const autoPlay = yield* storage.readAutoPlay();
			const machinePlayed = actsAutomatically( data, autoPlay, actorId );

			yield* timers.rearm( {
				frameDeadline: frame?.deadline,
				bot: machinePlayed ? BOT_DELAY_MS : undefined,
				moveTimeout: frame || machinePlayed ? undefined : data.config.moveTimeoutMillis
			} );
		} );

		/**
		 * Records a command's events as one commit and advances the log — the store
		 * appends it, stamps the record with the version it assigned, and shrinks
		 * the log to match, so acting after an undo forks the history rather than
		 * colliding with it. The next turn's timers are armed once that lands, and
		 * only then is the new state broadcast, so the envelope carries the clock
		 * the players are actually racing.
		 *
		 * @param acc - The accumulator holding the command's events and work.
		 * @param meta - What produced this commit: command, actor and move.
		 */
		const commitAndSave = Effect.fn( function* (
			acc: Accumulator<State, Config, Events>,
			meta: CommitMeta
		) {
			const commit = GameEventsCommit.make( {
				id: generateId(),
				at: yield* Clock.currentTimeMillis,
				...meta,
				events: acc.events
			} );

			const data = yield* storage.writeCommit( {
				commit,
				stamp: version => ( { ...acc.work, version } ),
				marksStart: meta.command === "start",
				marksComplete: acc.work.status === "COMPLETED"
			} );

			yield* armTimers( data );
			yield* broadcastState( data );
		} );

		/**
		 * Fails `NotAMember` unless the player holds a seat in this game.
		 * @param data - The record to check against.
		 * @param playerId - The player to verify.
		 */
		const assertMember = Effect.fn( function* (
			data: GameRecord<State, Config>,
			playerId: PlayerId
		) {
			if ( !data.players[ playerId ] ) {
				return yield* new NotAMember( { playerId } );
			}
		} );

		/**
		 * Writes a finished game to cold storage, keeping the table view and every
		 * player's final view alongside the game data.
		 *
		 * @param data - The completed game's record.
		 */
		const archiveGame = Effect.fn( function* ( data: GameRecord<State, Config> ) {
			const { tableView, playerViews } = buildViews( data );
			const { state, seed, ...header } = data;
			const completed = ArchiveSchema.make( { ...header, view: tableView, playerViews } );
			yield* archive.save( addressOf( data ), completed );
		} );

		/**
		 * Enters a phase: emits `PhaseEntered`, runs the phase's `onEnter`, then
		 * hands the turn to the phase's starting player when it resolves one.
		 *
		 * @param acc - The accumulator collecting this command's events.
		 * @param phaseName - The phase being entered.
		 */
		const enterPhase = Effect.fn( function* (
			acc: Accumulator<State, Config, Events>,
			phaseName: keyof PhaseMoves
		) {
			const phase = structure.phases?.[ phaseName ];
			if ( !phase ) {
				return yield* new PhaseNotFound( { phase: String( phaseName ) } );
			}

			acc.accumulate( PhaseEntered.make( { phase: String( phaseName ) } ) );

			if ( phase.onEnter ) {
				const enterPhaseRng = ( salt = "" ) => makeRng(
					hashSeed( acc.work.seed, acc.work.version, "enterPhase", salt )
				);

				acc.accumulate( ...phase.onEnter( acc.getGameData(), enterPhaseRng ) );
			}

			if ( phase.resolveStartingPlayer ) {
				const starting = phase.resolveStartingPlayer( acc.getGameData() );
				acc.accumulate( CurrentPlayerSet.make( { playerId: starting } ) );
			}
		} );


		/**
		 * Creates the game: builds the genesis record from the structure's
		 * `setup`, seats the creator as the current player, and writes an empty
		 * log. The seed generated here backs every shuffle and deal that follows,
		 * so it is stored but never published.
		 *
		 * @param payload - The game's id, code, creator and config.
		 * @returns The new game's id.
		 */
		const initialize = Effect.fn( function* ( payload: InitializeInput<Config> ) {
			const badTeams = validateTeamConfig( payload.config );
			if ( badTeams ) {
				return yield* badTeams;
			}

			const seed = generateId();
			const initialState = structure.setup(
				payload.config,
				( salt = "" ) => makeRng( hashSeed( seed, 0, "setup", salt ) )
			);

			const genesis = RecordSchema.make( {
				seed,
				version: 0,
				id: payload.id,
				code: payload.code,
				status: "CREATED",
				context: GameContext.make( {
					turn: 0,
					players: [],
					currentPlayer: PlayerId.make( payload.creator ),
					interactions: [],
					seats: {},
					teams: {},
					teamNames: {}
				} ),
				players: {},
				config: payload.config,
				state: initialState
			} );

			yield* storage.writeGenesis( genesis );

			return GameRef.make( { id: payload.id, code: payload.code } );
		} );


		/**
		 * Reads the game as one audience sees it: the shared table view alone, or
		 * that view merged with a seated player's private view.
		 *
		 * @param [playerId] - The player asking. Omit for the spectator view.
		 * @returns The game as that audience sees it, without the seed.
		 */
		const getState = Effect.fn( function* ( playerId?: PlayerId ) {
			const data = yield* load();
			const envelope = yield* envelopeFor( data );

			if ( !playerId ) {
				return envelope( viewFor( data, TableAudience.make( {} ) ) );
			}

			yield* assertMember( data, playerId );

			return envelope( viewFor( data, PlayerAudience.make( { playerId } ) ) );
		} );


		/**
		 * Seats a player, optionally on a side they picked. Re-joining is a no-op,
		 * so a reconnecting client may call it freely — which also means a re-join
		 * carrying a different side is ignored, and changing sides in the lobby is
		 * `joinTeam`'s job. Taking the last seat either arms auto-start or moves the
		 * game to `PLAYERS_READY`, depending on the config.
		 *
		 * The team is accepted here rather than only through the join endpoint
		 * because the creator never goes through it: a game's create handler seats
		 * them by calling this directly.
		 *
		 * @param playerInfo - The player or bot taking a seat.
		 * @returns The game's id and code.
		 */
		const join = Effect.fn( function* ( playerInfo: PlayerInfo ) {
			const data = yield* load();

			const playerId = playerInfo.id;
			if ( data.players[ playerId ] ) {
				return GameRef.make( { id: data.id, code: data.code } );
			}

			if ( data.status !== "CREATED" && data.status !== "PLAYERS_READY" ) {
				return yield* new GameNotJoinable( { status: data.status } );
			}

			if ( Object.keys( data.players ).length >= data.config.playerCount ) {
				return yield* new GameFull( { playerCount: data.config.playerCount } );
			}

			const acc = new Accumulator( data, structure.apply );

			if ( structure.hooks?.onJoin ) {
				acc.accumulate( ...structure.hooks.onJoin( acc.getGameData(), playerId ) );
			}

			acc.accumulate( PlayerJoined.make( { player: playerInfo } ) );

			const nowFull = Object.keys( acc.work.players ).length >= acc.work.config.playerCount;
			if ( nowFull && !acc.work.config.autoStart ) {
				acc.accumulate( StatusChanged.make( { status: "PLAYERS_READY" } ) );
			}

			yield* commitAndSave( acc, { command: "join", actor: playerId } );
			if ( nowFull && acc.work.config.autoStart ) {
				yield* timers.armAutoStart( AUTO_START_DELAY_MS );
			}

			return GameRef.make( { id: data.id, code: data.code } );
		} );

		/**
		 * Takes a side, or moves to another one, before the game starts. Sides are
		 * fixed once play begins: the seating order is built from them, so letting
		 * one change afterwards would reshuffle the table mid-game.
		 *
		 * @param playerId - The member taking the side.
		 * @param team - The side being taken.
		 */
		const joinTeam = Effect.fn( function* ( playerId: PlayerId, team: TeamId ) {
			const data = yield* load();
			yield* assertMember( data, playerId );

			if ( data.status !== "CREATED" && data.status !== "PLAYERS_READY" ) {
				return yield* new GameNotJoinable( { status: data.status } );
			}

			if ( teamOf( data.context, playerId ) === team ) {
				return;
			}

			const refusal = refuseTeam( structure.name, data.config, data.context, playerId, team );
			if ( refusal ) {
				return yield* refusal;
			}

			const acc = new Accumulator( data, structure.apply );
			acc.accumulate( TeamAssigned.make( { playerId, team } ) );

			yield* commitAndSave( acc, { command: "joinTeam", actor: playerId } );
		} );

		/**
		 * Names the caller's own side, once. Only someone playing on a side may
		 * name it, and only while it has no name — there is no rename, so the first
		 * of a side's members to ask is the one who chooses, and `TeamAlreadyNamed`
		 * refuses everyone after them rather than quietly replacing it.
		 *
		 * Confined to the lobby like the rest of team formation, which also keeps
		 * the commit below the one that started the game and therefore out of
		 * undo's reach.
		 *
		 * @param playerId - The member naming their side.
		 * @param team - The side being named.
		 * @param name - What it calls itself.
		 */
		const nameTeam = Effect.fn( function* ( playerId: PlayerId, team: TeamId, name: string ) {
			const data = yield* load();
			yield* assertMember( data, playerId );

			if ( data.status !== "CREATED" && data.status !== "PLAYERS_READY" ) {
				return yield* new GameNotJoinable( { status: data.status } );
			}

			const refusal = refuseName( structure.name, data.config, data.context, playerId, team );
			if ( refusal ) {
				return yield* refusal;
			}

			const chosen = yield* Schema.decodeUnknownEffect( TeamName )( name ).pipe(
				Effect.mapError( () => new InvalidTeamName( { name } ) )
			);

			const acc = new Accumulator( data, structure.apply );
			acc.accumulate( TeamNamed.make( { team, name: chosen } ) );

			yield* commitAndSave( acc, { command: "nameTeam", actor: playerId } );
		} );

		/**
		 * Fills every remaining seat with a generated bot.
		 * @param userId - The member asking for the seats to be filled.
		 */
		const addBots = Effect.fn( function* ( userId: PlayerId ) {
			const data = yield* load();
			yield* assertMember( data, userId );

			if ( data.status !== "CREATED" && data.status !== "PLAYERS_READY" ) {
				return yield* new GameNotJoinable( { status: data.status } );
			}

			const remaining = data.config.playerCount - Object.keys( data.players ).length;
			yield* Effect.all(
				Array.from( { length: remaining } )
					.map( () => generateBotInfo() )
					.map( bot => PlayerInfo.make( {
						id: PlayerId.make( bot.id ),
						name: bot.name,
						avatar: bot.avatar,
						isBot: true
					} ) )
					.map( player => join( player ) )
			);
		} );


		/**
		 * Starts a game whose seats are all taken: seats the sides when the game has
		 * any, runs `onStart`, enters the initial phase when the game is phased, and
		 * puts it in play.
		 *
		 * @param userId - The member starting the game.
		 */
		const start = Effect.fn( function* ( userId: PlayerId ) {
			const data = yield* load();
			yield* assertMember( data, userId );

			const count = Object.keys( data.players ).length;
			const cannotStart = data.status === "IN_PROGRESS"
				|| data.status === "COMPLETED"
				|| count < data.config.playerCount;

			if ( cannotStart ) {
				return yield* new CannotStart( { status: data.status } );
			}

			const acc = new Accumulator( data, structure.apply );

			const teams = acc.work.config.teams;
			if ( teams ) {
				const assigned = balanceTeams( teams, acc.work.context.players, acc.work.context.teams );

				for ( const playerId of acc.work.context.players ) {
					const team = assigned[ playerId ];
					if ( team && teamOf( acc.work.context, playerId ) !== team ) {
						acc.accumulate( TeamAssigned.make( { playerId, team } ) );
					}
				}

				for ( const team of teams ) {
					if ( nameOf( acc.work.context, team ) === undefined ) {
						const name = TeamName.make( generateTeamName() );
						acc.accumulate( TeamNamed.make( { team, name } ) );
					}
				}

				const order = interleaveSeats( teams, acc.work.context.players, assigned );
				acc.accumulate( SeatOrderSet.make( { order } ) );

				// Whoever the interleave seated first opens. This lands before
				// `enterPhase`, so a phase's own `resolveStartingPlayer` still wins.
				const first = order[ 0 ];
				if ( first ) {
					acc.accumulate( CurrentPlayerSet.make( { playerId: first } ) );
				}
			}

			if ( structure.hooks?.onStart ) {
				const startRng = ( salt = "" ) => makeRng(
					hashSeed( acc.work.seed, acc.work.version, "start", salt )
				);

				acc.accumulate( ...structure.hooks.onStart( acc.getGameData(), startRng ) );
			}

			if ( structure.phases && structure.initialPhase ) {
				yield* enterPhase( acc, structure.initialPhase );
			}

			acc.accumulate( StatusChanged.make( { status: "IN_PROGRESS" } ) );

			yield* commitAndSave( acc, { command: "start" } );
		} );


		/**
		 * Closes the frame a resolution ran for, and lands what that resolution
		 * produced.
		 *
		 * Any frame it opens is held back until after `InteractionResolved`, since
		 * that event pops whatever sits on top of the stack. Accumulated in the
		 * order the game returned them, a nested frame would be pushed and then
		 * popped in its parent's place — leaving the parent complete, resolving it
		 * a second time, and losing the nested frame entirely. Holding it back is
		 * what makes it the stack's new top: the parent settles, and the child
		 * suspends the unwinding until it settles in turn.
		 *
		 * Everything else keeps the order the game emitted it in, below the marker,
		 * so the events between a frame opening and closing are still its own.
		 *
		 * @param acc - The accumulator collecting this command's events.
		 * @param events - What the resolution produced, deadlines already stamped.
		 */
		const settleFrame = (
			acc: Accumulator<State, Config, Events>,
			events: ReadonlyArray<Events | InteractionOpened>
		) => {
			acc.accumulate( ...events.filter( event => !isInteractionOpened( event ) ) );
			acc.accumulate( InteractionResolved.make( {} ) );
			acc.accumulate( ...events.filter( isInteractionOpened ) );
		};

		/**
		 * Resolves the interaction stack from the top down for as long as frames
		 * are complete, so a frame whose resolution opens another one still
		 * settles inside the same command — and the one it opened is what the loop
		 * stops at, since a fresh frame has nobody's answer yet.
		 *
		 * @param acc - The accumulator collecting this command's events.
		 * @param now - The command's timestamp, stamped onto any frame this opens.
		 */
		const resolveInteractionIfComplete = (
			acc: Accumulator<State, Config, Events>,
			now: number
		) => {
			while ( true ) {
				if ( acc.work.context.interactions.length === 0 ) {
					break;
				}

				const [ top ] = acc.work.context.interactions.slice( -1 );
				const def = structure.interactions?.[ top.kind ];
				if ( !def ) {
					break;
				}

				const complete = def.isComplete
					? def.isComplete( acc.getGameData(), top )
					: top.responders.every( ( id ) => id in top.responses );

				if ( !complete ) {
					break;
				}

				const resolveEvents = def.resolve( acc.getGameData(), top );
				settleFrame( acc, stampDeadlines( resolveEvents, acc.work.config, now ) );
			}
		};

		/**
		 * Ends the game when `endIf` says it is over: runs `onEnd`, records the
		 * standings from `resolveResults`, then emits `GameCompleted`.
		 *
		 * @param acc - The accumulator collecting this command's events.
		 */
		const checkGameCompletion = ( acc: Accumulator<State, Config, Events> ) => {
			// A game completes once. `advanceTail` asks on two different paths — before
			// it enters the next phase, and at the tail of a turn that did not end one
			// — so an ask against a game already finished has to be a no-op rather
			// than a second `onEnd` and a second set of standings.
			if ( acc.work.status === "COMPLETED" ) {
				return;
			}

			const ended = structure.endIf( acc.getGameData() );
			if ( ended ) {
				if ( structure.hooks?.onEnd ) {
					acc.accumulate( ...structure.hooks.onEnd( acc.getGameData() ) );
				}

				if ( structure.resolveResults ) {
					const resolved = structure.resolveResults( acc.getGameData() );
					const teams = acc.work.config.teams;

					acc.accumulate( ResultsResolved.make( {
						results: teams
							? withTeamStandings( resolved, acc.work.context, teams )
							: resolved
					} ) );
				}

				acc.accumulate( GameCompleted.make( {} ) );
			}
		};


		/**
		 * Closes out a turn-ending move: advances the turn counter, moves the
		 * phase or the current player on, then checks whether the game is over.
		 * A phased game follows its phase's resolution; a flat game uses the
		 * structure's `resolveNextPlayer`, falling back to round-robin over the
		 * seats still active.
		 *
		 * Completion is asked exactly once per call, but *where* depends on the
		 * path: a turn that ended a phase is judged before the next one is entered,
		 * so `endIf` sees the position the round finished in rather than the one
		 * that phase's `onEnter` has already dealt out. Every other path is judged
		 * at the tail, where the move left the game.
		 *
		 * @param acc - The accumulator collecting this command's events.
		 * @param actorId - The player who just acted.
		 * @param move - The move that ended the turn.
		 */
		const advanceTail = Effect.fn( function* (
			acc: Accumulator<State, Config, Events>,
			actorId: PlayerId,
			move: string
		) {
			acc.accumulate( TurnAdvanced.make( {} ) );

			if ( structure.phases ) {
				const phaseName = String( acc.work.context.phase ?? structure.initialPhase );
				const phase = structure.phases[ phaseName ];
				if ( !phase ) {
					return yield* new PhaseNotFound( { phase: phaseName } );
				}

				const phaseEnded = phase.endIf( acc.getGameData() );

				if ( phaseEnded ) {
					const nextPhaseName = phase.resolveNextPhase( acc.getGameData() );
					if ( phase.onExit ) {
						acc.accumulate( ...phase.onExit( acc.getGameData() ) );
					}

					acc.accumulate( PhaseExited.make( { phase: phaseName } ) );

					// The game is decided here, on the position the round ended in — and
					// only here on this path. Entering the next phase runs its `onEnter`,
					// which is where a game deals the hand or turns up the row the coming
					// round is played from; asking afterwards would put the question to a
					// table already set up for a round nobody is going to play, and a game
					// whose end condition reads "nothing left to draw" would call itself
					// over a full round early.
					checkGameCompletion( acc );

					if ( acc.work.status !== "COMPLETED" ) {
						yield* enterPhase( acc, nextPhaseName );
					}

					return;

				} else if ( phase.resolveNextPlayer ) {
					const next = phase.resolveNextPlayer( acc.getGameData(), actorId, move );
					acc.accumulate( CurrentPlayerSet.make( { playerId: next } ) );
				}
			} else if ( structure.resolveNextPlayer ) {
				const next = structure.resolveNextPlayer( acc.getGameData(), actorId, move );
				acc.accumulate( CurrentPlayerSet.make( { playerId: next } ) );
			} else {
				const next = nextActiveSeat( acc.work.context, actorId );
				if ( next ) {
					acc.accumulate( CurrentPlayerSet.make( { playerId: next } ) );
				}
			}

			checkGameCompletion( acc );
		} );


		/**
		 * Plays a move. The engine gates it first — membership, seat, status,
		 * phase and turn — then decodes the input and folds the move's events into
		 * a commit. A move played while an interaction is open is routed to that
		 * frame as a response, and the turn does not advance until the frame
		 * resolves. A completed game is archived; otherwise the next bot, if any,
		 * is scheduled.
		 *
		 * @typeParam MoveType - The move being played.
		 * @param moveType - The move's name.
		 * @param raw - The move's input, still undecoded.
		 * @param playerId - The player making the move.
		 */
		const submitMove = <MoveType extends keyof MoveInputs>(
			moveType: MoveType,
			raw: MoveInputs[MoveType][ "Type" ],
			playerId: PlayerId
		) => Effect.gen( function* () {
			const move = String( moveType );
			const now = yield* Clock.currentTimeMillis;
			const data = yield* load();
			yield* assertMember( data, playerId );

			if ( data.status !== "IN_PROGRESS" ) {
				return yield* new GameNotInProgress( { status: data.status } );
			}

			if ( !isSeatActive( data.context, playerId ) ) {
				return yield* new MoveNotAllowed( { move } );
			}

			const moveInputSchema = structure.schemas.moves[ moveType ];
			const moveDef = structure.moves[ moveType ];

			if ( moveDef.enabledWhen && !moveDef.enabledWhen( data.config ) ) {
				return yield* new MoveNotAllowed( { move } );
			}

			const moveRng = ( salt = "" ) =>
				makeRng( hashSeed( data.seed, data.version, move, salt ) );

			const input = yield* Schema.decodeUnknownEffect( moveInputSchema )( raw )
				.pipe( Effect.mapError( issue => new InvalidMove( { move, reason: issue.message } ) ) );

			const acc = new Accumulator( data, structure.apply );

			if ( acc.work.context.interactions.length > 0 ) {
				const [ active ] = acc.work.context.interactions.slice( -1 );

				const idef = structure.interactions?.[ active.kind ];
				if ( !idef || !idef.responseMoves.includes( moveType ) ) {
					return yield* new MoveNotAllowed( { move } );
				}

				const allowed = idef.canRespond
					? idef.canRespond( acc.getGameData(), active, playerId )
					: active.mode === "sequential"
						? active.responders.find( pid => !( pid in active.responses ) ) === playerId
						: active.responders.includes( playerId ) && !( playerId in active.responses );

				if ( !allowed ) {
					return yield* new NotYourTurn( {
						playerId,
						currentPlayer: acc.work.context.currentPlayer
					} );
				}

				const error = moveDef.validate( acc.getGameData(), playerId, input );
				if ( error ) {
					return yield* error;
				}

				const moveEvents = moveDef.execute( acc.getGameData(), playerId, input, moveRng );
				acc.accumulate( ...stampDeadlines( moveEvents, acc.work.config, now ) );
				acc.accumulate( InteractionResponded.make( { playerId, response: input } ) );

				resolveInteractionIfComplete( acc, now );

				if ( acc.work.context.interactions.length === 0 ) {
					const originalActor = data.context.interactions?.[ 0 ]?.initiator ?? playerId;
					yield* advanceTail( acc, originalActor, move );
				}

			} else {
				// --- normal move branch --------------------------------------------

				if ( structure.phases && structure.initialPhase ) {
					const phase = String( acc.work.context.phase ?? structure.initialPhase );
					if ( !structure.phases[ phase ] ) {
						return yield* new PhaseNotFound( { phase } );
					}

					if ( !structure.phases[ phase ].moves.includes( move ) ) {
						return yield* new MoveNotAllowed( { move } );
					}
				}

				const allowed = moveDef.canMove
					? moveDef.canMove( acc.getGameData(), playerId )
					: data.context.currentPlayer === playerId;

				if ( !allowed ) {
					return yield* new NotYourTurn( {
						playerId,
						currentPlayer: acc.work.context.currentPlayer
					} );
				}

				if ( structure.hooks?.beforeMove ) {
					acc.accumulate( ...structure.hooks.beforeMove( acc.getGameData(), playerId, move ) );
				}

				const error = moveDef.validate( acc.getGameData(), playerId, input );
				if ( error ) {
					return yield* error;
				}

				const moveEvents = moveDef.execute( acc.getGameData(), playerId, input, moveRng );
				acc.accumulate( ...stampDeadlines( moveEvents, acc.work.config, now ) );

				if ( structure.hooks?.afterMove ) {
					acc.accumulate( ...structure.hooks.afterMove( acc.getGameData(), playerId, move ) );
				}

				if ( acc.work.context.interactions.length === 0 ) {
					const endsTurn = typeof moveDef.endsTurn === "function"
						? moveDef.endsTurn( acc.getGameData(), playerId, input )
						: moveDef.endsTurn ?? true;

					if ( !endsTurn ) {
						checkGameCompletion( acc );
					} else {
						yield* advanceTail( acc, playerId, move );
					}
				}
			}

			yield* commitAndSave( acc, { command: "submitMove", actor: playerId, moveType: move } );

			if ( acc.work.status === "COMPLETED" ) {
				yield* archiveGame( acc.work );
			}
		} );

		/**
		 * The structure's moves as first-class commands, so a host calls
		 * `engine.<moveName>( input, playerId )` rather than routing everything
		 * through `submitMove`.
		 */
		const moves = Object.keys( structure.moves )
			.map( m => m as keyof MoveInputs )
			.reduce(
				( acc, name ) => {
					acc[ name ] = ( input, playerId ) => submitMove( name, input, playerId );
					return acc;
				},
				{} as {
					[K in keyof MoveInputs]: (
						input: MoveInputs[K][ "Type" ],
						playerId: PlayerId
					) => ReturnType<typeof submitMove<K>>;
				}
			);


		/**
		 * The commit at a position, when it is a move somebody played. Anything
		 * else — a join, the start, a timeout the engine committed on its own — has
		 * no owner, so there is nobody it could be authorized against.
		 *
		 * @param index - The position in the log.
		 * @returns The move commit at that position, if that is what sits there.
		 */
		const moveCommitAt = Effect.fn( function* ( index: number ) {
			if ( index < 0 ) {
				return undefined;
			}

			const commit = yield* storage.readCommit<GameEventsCommit>( index );
			return commit?.command === "submitMove" ? commit : undefined;
		} );

		/**
		 * Steps the log cursor back one commit and rebuilds the game there. Only
		 * moves in a game still in progress can be undone, so the cursor never
		 * rewinds past the commit that started the game.
		 *
		 * A player may only take back their own move, and only while it is still
		 * the newest commit. Since the check is against the commit *at* the cursor,
		 * "no one has played on top of it" comes for free: anything committed since
		 * — another player's move, a bot's, a timeout — is what sits there instead,
		 * and it has to come off first, by whoever owns it.
		 *
		 * @param playerId - The member asking to undo.
		 */
		const undo = Effect.fn( function* ( playerId: PlayerId ) {
			const data = yield* load();
			yield* assertMember( data, playerId );

			const cursor = yield* storage.readCursor();
			const startCursor = yield* storage.readStartCommitCursor();
			const completeCursor = yield* storage.readCompletedCommitCursor();

			const isComplete = completeCursor >= 0 && cursor >= completeCursor;
			const hasNotStarted = startCursor < 0 || cursor <= startCursor;
			const notInProgress = data.status !== "IN_PROGRESS";
			const isCommitAvailableToUndo = cursor > -1;

			if ( isComplete || hasNotStarted || notInProgress || !isCommitAvailableToUndo ) {
				return yield* new NothingToUndo( { cursor } );
			}

			const top = yield* moveCommitAt( cursor );
			if ( !top || top.actor !== playerId ) {
				return yield* new UndoNotAllowed( { playerId, cursor } );
			}

			const next = cursor - 1;
			const work = yield* refold( next );

			yield* storage.moveCursor( next, work );

			yield* timers.cancelAll();
			yield* armTimers( work );
			yield* broadcastState( work );
		} );


		/**
		 * Steps the log cursor forward one commit and rebuilds the game there,
		 * replaying a move that was undone. Committing a new move forks the log at
		 * the cursor, so redo is only available until that happens.
		 *
		 * Undo's mirror in authorization too: the move being replayed must belong
		 * to the player asking for it, since that is the player whose undo put it
		 * within reach.
		 *
		 * @param playerId - The member asking to redo.
		 */
		const redo = Effect.fn( function* ( playerId: PlayerId ) {
			const data = yield* load();
			yield* assertMember( data, playerId );

			const count = yield* storage.readCommitCount();
			const cursor = yield* storage.readCursor();
			const startCursor = yield* storage.readStartCommitCursor();
			const completeCursor = yield* storage.readCompletedCommitCursor();

			const isComplete = completeCursor >= 0 && cursor >= completeCursor;
			const hasNotStarted = startCursor < 0 || cursor < startCursor;
			const notInProgress = data.status !== "IN_PROGRESS";
			const isCommitAvailableToRedo = cursor < count - 1;

			if ( isComplete || hasNotStarted || notInProgress || !isCommitAvailableToRedo ) {
				return yield* new NothingToRedo( { cursor } );
			}

			const next = cursor + 1;

			const pending = yield* moveCommitAt( next );
			if ( !pending || pending.actor !== playerId ) {
				return yield* new RedoNotAllowed( { playerId, cursor } );
			}

			const work = yield* refold( next );

			yield* storage.moveCursor( next, work );

			yield* timers.cancelAll();
			yield* armTimers( work );
			yield* broadcastState( work );
		} );


		/**
		 * Cancels every pending timer and erases the game's storage. Called once a
		 * finished game has been archived, or to drop one that was abandoned.
		 */
		const cleanup = Effect.fn( function* () {
			yield* timers.cancelAll();
			yield* storage.clear();
		} );


		/**
		 * Hands a seat to the game's `botMove` policy, or takes it back. A player
		 * may only switch their own seat, and the switch is deliberately *not* a
		 * commit: autoplay schedules the game rather than describing it, so it
		 * neither moves the version nor rewinds under undo. Rearming immediately
		 * swaps the seat's move clock for the bot delay, or restores it.
		 *
		 * A game with no policy has nothing to hand the seat to, so the request is
		 * refused rather than recorded: storing it would publish a seat as
		 * auto-played while it still counts down on its own clock.
		 *
		 * @param playerId - The member switching their own seat.
		 * @param enabled - `true` to let the policy play for them.
		 */
		const setAutoPlay = Effect.fn( function* ( playerId: PlayerId, enabled: boolean ) {
			const data = yield* load();
			yield* assertMember( data, playerId );

			if ( enabled && !structure.botMove ) {
				return yield* new AutoPlayUnavailable( { game: structure.name } );
			}

			yield* storage.writeAutoPlay( playerId, enabled );
			yield* armTimers( data );
			yield* broadcastState( data );
		} );

		/**
		 * Closes an open frame that cannot progress on its own: the interaction's
		 * `onTimeout` settles it if it has one, otherwise `resolve` runs against
		 * whatever responses did arrive. Parent frames this completes settle in the
		 * same commit, and the turn advances if the stack empties. Reached only
		 * once nobody is left who could still answer, so it is the terminal move
		 * that stops a silent seat holding the table.
		 *
		 * A settlement may open a frame of its own, exactly as a resolution reached
		 * by an answer may, and the table then waits on that instead of moving on.
		 *
		 * @param data - The record holding the stalled frame.
		 */
		const forceSettleFrame = Effect.fn( function* ( data: GameRecord<State, Config> ) {
			const [ frame ] = data.context.interactions.slice( -1 );
			const def = frame ? structure.interactions?.[ frame.kind ] : undefined;

			if ( !frame || !def ) {
				return;
			}

			const now = yield* Clock.currentTimeMillis;
			const acc = new Accumulator( data, structure.apply );
			const settle = def.onTimeout ?? def.resolve;
			const settledEvents = settle( acc.getGameData(), frame );

			settleFrame( acc, stampDeadlines( settledEvents, acc.work.config, now ) );
			resolveInteractionIfComplete( acc, now );

			if ( acc.work.context.interactions.length === 0 ) {
				yield* advanceTail( acc, frame.initiator, frame.kind ).pipe( Effect.orDie );
			}

			yield* commitAndSave( acc, { command: "alarm" } );

			if ( acc.work.status === "COMPLETED" ) {
				yield* archiveGame( acc.work );
			}
		} );

		/**
		 * Plays the pending seat through the game's `botMove` policy — a bot's, or
		 * a human's that has been handed over. When the policy passes, or the game
		 * declares none, a frame already past its deadline is force-settled instead,
		 * so a silent seat can never leave the table waiting indefinitely.
		 *
		 * @param data - The record the seat acts on.
		 */
		const playAutomatically = Effect.fn( function* ( data: GameRecord<State, Config> ) {
			const actorId = pendingActor( data );
			const actor = actorId ? data.players[ actorId ] : undefined;
			const autoPlay = yield* storage.readAutoPlay();

			const canMoveAutomatically = actorId && actor &&
				structure.botMove &&
				actsAutomatically( data, autoPlay, actorId );

			if ( canMoveAutomatically ) {
				const move = structure.botMove( {
					config: data.config,
					context: data.context,
					state: viewFor( data, PlayerAudience.make( { playerId: actorId } ) )
				} );

				if ( move ) {
					return yield* submitMove( move.moveType, move.input, actorId ).pipe( Effect.orDie );
				}
			}

			yield* forceSettleFrame( data );
		} );

		/**
		 * Runs out a seat's move clock. With a bot policy the seat is handed to it
		 * and stays there until its player switches it back, which is what stops
		 * the same player stalling every subsequent turn.
		 *
		 * A game that declares no policy has nothing that could play the seat, so
		 * the turn is skipped and the seat is left exactly as it was. Handing it
		 * over would be a lie the wire repeats — `autoPlay` would read `true` for a
		 * seat nothing is playing — and it would cost that seat its clock on every
		 * later turn, leaving the table with no pending timer at all.
		 *
		 * @param data - The record whose current player ran out of time.
		 */
		const timeOutMove = Effect.fn( function* ( data: GameRecord<State, Config> ) {
			const actorId = pendingActor( data );
			const autoPlay = yield* storage.readAutoPlay();

			const stillTheirs = actorId
				&& data.context.interactions.length === 0
				&& !actsAutomatically( data, autoPlay, actorId );

			if ( !actorId || !stillTheirs ) {
				return;
			}

			if ( !structure.botMove ) {
				const acc = new Accumulator( data, structure.apply );
				yield* advanceTail( acc, actorId, "move-timeout" ).pipe( Effect.orDie );
				yield* commitAndSave( acc, { command: "alarm", actor: actorId } );

				if ( acc.work.status === "COMPLETED" ) {
					yield* archiveGame( acc.work );
				}

				return;
			}

			yield* storage.writeAutoPlay( actorId, true );

			// The seat is the policy's now, so the turn runs under the bot delay
			// alone. Rearming is what drops the spent move clock, and with it the
			// deadline the seat was counting down, before the flag flip goes out.
			yield* timers.rearm( { bot: TIMED_OUT_DELAY_MS } );
			yield* broadcastState( data );
		} );

		/**
		 * Runs out an open frame: every responder still silent is handed to the bot
		 * policy so it answers for them, which resolves the frame the way the game
		 * meant it to resolve. Without a policy there is nobody to answer, so the
		 * frame is force-settled instead.
		 *
		 * @param data - The record holding the expired frame.
		 */
		const timeOutInteraction = Effect.fn( function* ( data: GameRecord<State, Config> ) {
			const [ frame ] = data.context.interactions.slice( -1 );
			if ( !frame ) {
				return;
			}

			if ( !structure.botMove ) {
				return yield* forceSettleFrame( data );
			}

			const silent = frame.responders.filter( id => !( id in frame.responses ) );
			yield* Effect.forEach( silent, id => storage.writeAutoPlay( id, true ) );

			// The frame's own expiry has just fired and every silent responder is on
			// the policy now, so the only clock left to run is the bot delay.
			yield* timers.rearm( { bot: TIMED_OUT_DELAY_MS } );
			yield* broadcastState( data );
		} );

		/**
		 * The host's wake-up callback, run when a scheduled timer comes due. Each
		 * kind is handled by the branch that owns it and re-arms on the way out, so
		 * one timer coming due never swallows another.
		 */
		const alarm = Effect.fn( function* () {
			const data = yield* load().pipe( Effect.catch( () => Effect.succeed( null ) ) );
			if ( !data ) {
				return;
			}

			const due = yield* timers.due();
			if ( due.length === 0 ) {
				return;
			}

			// `auto-start` belongs to a game that has not started; starting re-arms
			// whatever the game needs next, so nothing else applies on this wake-up.
			// A member who started the table by hand in the meantime gets there first,
			// and the timer they beat is simply spent.
			if ( due.includes( "auto-start" ) ) {
				const startable = data.status === "CREATED" || data.status === "PLAYERS_READY";
				return startable
					? yield* start( data.context.currentPlayer ).pipe( Effect.orDie )
					: undefined;
			}

			if ( data.status !== "IN_PROGRESS" ) {
				return;
			}

			if ( due.includes( "move-timeout" ) ) {
				return yield* timeOutMove( data );
			}

			if ( due.includes( "interaction-timeout" ) ) {
				return yield* timeOutInteraction( data );
			}

			if ( due.includes( "bot" ) ) {
				yield* playAutomatically( data );
			}
		} );

		return {
			initialize,
			join,
			joinTeam,
			nameTeam,
			addBots,
			start,
			cleanup,
			undo,
			redo,
			...moves,
			alarm,
			getState,
			setAutoPlay
		};
	} );
};
