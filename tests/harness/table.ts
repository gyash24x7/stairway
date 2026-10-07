import * as Cause from "effect/Cause";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import type * as Schema from "effect/Schema";

import type * as Sharding from "effect/cluster/Sharding";
import type * as Persistence from "effect/persistence/Persistence";

import { makeTestEnv } from "@tests/harness/layers";
import type { TestUser } from "@tests/harness/users";
import { firstSeats } from "@tests/harness/users";

import type { Database } from "@/shared/utils/database";
import type { Generator } from "@/shared/utils/generator";
import type {
	AutoPlayInput,
	BaseGameConfig,
	GameId,
	GameRef,
	GameView,
	Hint,
	InteractionFrame,
	JoinTeamInput,
	NameTeamInput,
	PassInteractionInput,
	PlayerId,
	RematchInput,
	SwishUser
} from "@/swish/schema";
import {
	AutoPlayInput as AutoPlay,
	JoinTeamInput as JoinTeam,
	NameTeamInput as NameTeam,
	PassInteractionInput as PassInteraction,
	RematchInput as Rematch,
	TeamId as Team
} from "@/swish/schema";
import { activeFrame } from "@/swish/utils";


// --- Inferring a game's shape from its structure ---------------------------

/**
 * The move names and input types a game declares, read back off its structure.
 *
 * Worth the conditional: it is what makes `table.move( "alice", "place", { … } )`
 * a typed call rather than a string and an `unknown`. A misspelled move or a
 * malformed input then fails at `bun run typecheck` instead of at runtime, in a
 * suite whose whole job is to notice that kind of mistake.
 */
export type MovesOf<S> = S extends { readonly schemas: { readonly moves: infer M } }
	? { [K in keyof M]: M[ K ] extends Schema.Codec<infer A, unknown> ? A : never }
	: never;

export type ViewOf<S> = S extends { readonly schemas: { readonly view: infer V } }
	? V extends Schema.Codec<infer A, unknown> ? A : never
	: never;

export type ConfigOf<S> = S extends { readonly schemas: { readonly config: infer C } }
	? C extends Schema.Codec<infer A, unknown> ? A : never
	: never;

/** The commands the engine facade exposes, as the harness uses them. */
type EngineApi<Config extends BaseGameConfig, Moves, View> = {
	readonly createGame: (
		payload: Partial<Config> & { isPrivate: boolean }
	) => ( user: SwishUser ) => Effect.Effect<GameRef, unknown>;
	readonly joinGame: ( params: GameRef ) => ( user: SwishUser ) => Effect.Effect<void, unknown>;
	readonly spectate: ( params: GameRef ) => ( user: SwishUser ) => Effect.Effect<void, unknown>;
	readonly addBots: ( params: GameRef ) => ( user: SwishUser ) => Effect.Effect<void, unknown>;
	readonly startGame: ( params: GameRef ) => ( user: SwishUser ) => Effect.Effect<void, unknown>;
	readonly undo: ( params: GameRef ) => ( user: SwishUser ) => Effect.Effect<void, unknown>;
	readonly redo: ( params: GameRef ) => ( user: SwishUser ) => Effect.Effect<void, unknown>;
	readonly leaveTeam: ( params: GameRef ) => ( user: SwishUser ) => Effect.Effect<void, unknown>;
	readonly joinTeam: (
		params: GameRef,
		input: JoinTeamInput
	) => ( user: SwishUser ) => Effect.Effect<void, unknown>;
	readonly nameTeam: (
		params: GameRef,
		input: NameTeamInput
	) => ( user: SwishUser ) => Effect.Effect<void, unknown>;
	readonly autoPlay: (
		params: GameRef,
		input: AutoPlayInput
	) => ( user: SwishUser ) => Effect.Effect<void, unknown>;
	readonly pass: (
		params: GameRef,
		input: PassInteractionInput
	) => ( user: SwishUser ) => Effect.Effect<void, unknown>;
	readonly rematch: (
		params: GameRef,
		input: RematchInput
	) => ( user: SwishUser ) => Effect.Effect<GameRef, unknown>;
	readonly getView: (
		params: GameRef
	) => ( user: SwishUser ) => Effect.Effect<GameView<View, Config>, unknown>;
	readonly hint: (
		params: GameRef
	) => ( user: SwishUser ) => Effect.Effect<Hint<Moves>, unknown>;
	readonly submitMove: <K extends keyof Moves>(
		move: K,
		params: GameRef,
		input: Moves[ K ]
	) => ( user: SwishUser ) => Effect.Effect<void, unknown>;
};

/** What `makeEngine` hands back, as the harness needs it. */
export type GameModule<Structure> = {
	readonly Structure: Structure;
	readonly Engine: Effect.Effect<
		EngineApi<ConfigOf<Structure> & BaseGameConfig, MovesOf<Structure>, ViewOf<Structure>>,
		never,
		Generator | Sharding.Sharding
	>;
	readonly EngineLive: Layer.Layer<
		never,
		never,
		Database | Generator | Persistence.Persistence | Sharding.Sharding
	>;
};


// --- The table -------------------------------------------------------------

export type TableOptions<Config> = {

	/** Seat handles, in join order. The first one creates the table. */
	readonly players?: ReadonlyArray<TestUser>;

	/** How many seats to take from the default handles, when `players` is absent. */
	readonly seats?: number;

	/**
	 * Config overrides, merged over the game's `defaultConfig()`.
	 *
	 * Left alone, a table inherits the game's real clocks — which for most games
	 * means a bot starts playing a few seconds in. Tests that are not about the
	 * clock should park it; `PARKED` below is that setting.
	 */
	readonly config?: Partial<Config>;

	/** Namespace for this table's generated ids. Defaults to the game's name. */
	readonly name?: string;

	/** Whether the table is private. Defaults to `true`; nothing here reads the lobby. */
	readonly isPrivate?: boolean;
};

/**
 * Clocks pushed far enough out that no timer fires during a test.
 *
 * Spread into `config` for anything that is not deliberately about timing. The
 * engine arms a real fiber per write (`engine.ts:347`); a test that is not
 * waiting for it wants it never to come due, not merely to come due late.
 */
export const PARKED = { botDelayMillis: 3_600_000, moveTimeoutMillis: 3_600_000 } as const;

/** A user who is neither seated nor watching, so `getView` builds the table's view. */
const OBSERVER: SwishUser = { id: "observer", name: "Observer", avatar: "avatar://observer" };

const seatOf = ( seat: TestUser | string, roster: ReadonlyArray<TestUser> ) => {
	if ( typeof seat !== "string" ) {
		return seat;
	}

	const found = roster.find( user => user.id === seat );
	if ( !found ) {
		throw new Error( `swish tests: no seat named "${ seat }" at this table` );
	}

	return found;
};

/**
 * Builds a live table and hands back the ways to act on it.
 *
 * The whole environment is built inside the test's own scope, so each table gets
 * its own entity, its own hot store and its own ledger — nothing leaks between
 * tests, and an id sequence can be reasoned about from the top of the test.
 *
 * Use it from `it.live`, not `it.effect`: the turn clock sleeps and then sends
 * itself a message through the cluster, and a virtual clock has no way to drive
 * the mailbox that message sits in.
 *
 * @param game - What `makeEngine` returned for the game under test.
 * @param options - Who is at the table and what it was created with.
 * @returns The table's commands, views and ledger.
 */
export const makeTable = <Structure extends { readonly name: string }>(
	game: GameModule<Structure>,
	options: TableOptions<ConfigOf<Structure>> = {}
) => Effect.gen( function* () {
	type Moves = MovesOf<Structure>;
	type View = ViewOf<Structure>;
	type Config = ConfigOf<Structure> & BaseGameConfig;

	const roster = options.players ?? firstSeats( options.seats ?? 2 );
	const host = roster[ 0 ];
	if ( !host ) {
		throw new Error( "swish tests: a table needs at least one seat" );
	}

	const env = makeTestEnv( options.name ?? game.Structure.name );
	const context = yield* Layer.build( game.EngineLive.pipe( Layer.provideMerge( env.layer ) ) );
	const engine = yield* Effect.provideContext( game.Engine, context );

	const ref = yield* Effect.provideContext(
		engine.createGame( {
			...options.config,
			isPrivate: options.isPrivate ?? true
		} as Partial<Config> & { isPrivate: boolean } )( host ),
		context
	);

	const run = <A>( effect: Effect.Effect<A, unknown, never> ) =>
		Effect.provideContext( effect, context );

	const view = ( seat?: TestUser | string ) => run(
		engine.getView( ref )( seat === undefined ? OBSERVER : seatOf( seat, roster ) )
	) as Effect.Effect<GameView<View, Config>, unknown>;

	return {

		/** The table's id — also its entity id, and the seed for every draw. */
		id: ref.gameId as GameId,

		/** The reference every command takes. */
		ref,

		/** The seats, in join order. The first one created the table. */
		roster,

		/** The engine facade, for anything the helpers below do not wrap. */
		engine,

		/**
		 * Runs an engine call against this table's services.
		 *
		 * The escape hatch for a caller the helpers below cannot express — a user
		 * who holds no seat, most often, since every helper addresses somebody on
		 * the roster.
		 */
		run: <A, E>( effect: Effect.Effect<A, E, never> ) => run( effect ),

		/** Every statement the ledger issued. */
		ledger: env.ledger,

		/** Every id the stubbed generator handed out, in order. */
		ids: env.ids,

		// --- Lobby ---------------------------------------------------------

		join: ( seat: TestUser | string ) =>
			run( engine.joinGame( ref )( seatOf( seat, roster ) ) ),

		/** Seats everyone but the host, who was seated by `createGame`. */
		joinAll: () => Effect.forEach(
			roster.slice( 1 ),
			user => run( engine.joinGame( ref )( user ) ),
			{ discard: true }
		),

		spectate: ( user: SwishUser ) => run( engine.spectate( ref )( user ) ),

		addBots: ( seat: TestUser | string = host ) =>
			run( engine.addBots( ref )( seatOf( seat, roster ) ) ),

		start: ( seat: TestUser | string = host ) =>
			run( engine.startGame( ref )( seatOf( seat, roster ) ) ),

		joinTeam: ( seat: TestUser | string, team: string ) =>
			run( engine.joinTeam(
				ref,
				JoinTeam.make( { team: Team.make( team ) } )
			)(
				seatOf( seat, roster ) ) ),

		leaveTeam: ( seat: TestUser | string ) =>
			run( engine.leaveTeam( ref )( seatOf( seat, roster ) ) ),

		nameTeam: ( seat: TestUser | string, team: string, name: string ) =>
			run( engine.nameTeam(
				ref,
				NameTeam.make( { team: Team.make( team ), name } )
			)( seatOf( seat, roster ) ) ),

		// --- Play ----------------------------------------------------------

		move: <K extends keyof Moves>( seat: TestUser | string, name: K, input: Moves[ K ] ) =>
			run( engine.submitMove( name, ref, input )( seatOf( seat, roster ) ) ),

		/**
		 * The same command as `move`. Spelled differently only so a test reads
		 * the way the table does — this one is answering an open window.
		 */
		respond: <K extends keyof Moves>( seat: TestUser | string, name: K, input: Moves[ K ] ) =>
			run( engine.submitMove( name, ref, input )( seatOf( seat, roster ) ) ),

		pass: ( seat: TestUser | string, frameId?: string ) =>
			run( engine.pass( ref, PassInteraction.make( { frameId } ) )( seatOf( seat, roster ) ) ),

		undo: ( seat: TestUser | string ) => run( engine.undo( ref )( seatOf( seat, roster ) ) ),

		redo: ( seat: TestUser | string ) => run( engine.redo( ref )( seatOf( seat, roster ) ) ),

		autoPlay: ( seat: TestUser | string, enabled: boolean ) =>
			run( engine.autoPlay( ref, AutoPlay.make( { enabled } ) )( seatOf( seat, roster ) ) ),

		/** Asks for the next table, and answers with the one there is. */
		rematch: ( seat: TestUser | string, keepTeams = false ) =>
			run( engine.rematch( ref, Rematch.make( { keepTeams } ) )( seatOf( seat, roster ) ) ),

		/**
		 * The table a rematch made, driven the same way this one is.
		 *
		 * It lives in the same environment — same entity runtime, same ledger,
		 * same id sequence — because it is the same process that built it. Only
		 * the reference differs.
		 */
		follow: ( next: GameRef ) => ( {
			ref: next,
			view: ( seat?: TestUser | string ) => run(
				engine.getView( next )( seat === undefined ? OBSERVER : seatOf( seat, roster ) )
			) as Effect.Effect<GameView<View, Config>, unknown>,
			move: <K extends keyof Moves>( seat: TestUser | string, name: K, input: Moves[ K ] ) =>
				run( engine.submitMove( name, next, input )( seatOf( seat, roster ) ) ),
			start: ( seat: TestUser | string = host ) =>
				run( engine.startGame( next )( seatOf( seat, roster ) ) ),
			rematch: ( seat: TestUser | string, keepTeams = false ) =>
				run( engine.rematch( next, Rematch.make( { keepTeams } ) )( seatOf( seat, roster ) ) )
		} ),

		// --- Reading -------------------------------------------------------

		/** The game as one seat sees it, or as the table does when `seat` is omitted. */
		view,

		/**
		 * What the game would play for one seat.
		 *
		 * Takes a seat and never a table, unlike `view`: a hint is about somebody,
		 * and there is no audience-wide answer to ask for.
		 */
		hint: ( seat: TestUser | string ) => run(
			engine.hint( ref )( seatOf( seat, roster ) )
		) as Effect.Effect<Hint<Moves>, unknown>,

		/** Just the game-owned part of that view. */
		state: ( seat?: TestUser | string ) => Effect.map( view( seat ), got => got.view ),

		/** The engine-owned context: seat order, current player, phase, windows. */
		context: () => Effect.map( view(), got => got.context ),

		/** The open interaction window, or `undefined`. */
		frame: () => Effect.map(
			view(),
			got => activeFrame( got.context ) as InteractionFrame | undefined
		),

		/** Whose turn it is. */
		current: () => Effect.map( view(), got => got.context.currentPlayer as PlayerId | undefined ),

		status: () => Effect.map( view(), got => got.status ),

		results: () => Effect.map( view(), got => got.results ),

		// --- Waiting -------------------------------------------------------

		/**
		 * Polls the table until it looks the way the test expects.
		 *
		 * Anything a timer drives — a bot taking its turn, a window running out —
		 * arrives as a message the entity handles on its own, so there is no effect
		 * to await. Polling on the live clock is how a test joins that back up.
		 *
		 * @param predicate - Read off the table's own view.
		 * @param timeout - How long to keep asking. Defaults to two seconds.
		 */
		waitUntil: (
			predicate: ( got: GameView<View, Config> ) => boolean,
			timeout: Duration.Input = Duration.seconds( 2 )
		) => Effect.gen( function* () {
			const deadline = Duration.toMillis( timeout );
			const started = yield* Effect.clockWith( clock => clock.currentTimeMillis );

			while ( true ) {
				const got = yield* view();
				if ( predicate( got ) ) {
					return got;
				}

				const now = yield* Effect.clockWith( clock => clock.currentTimeMillis );
				if ( now - started > deadline ) {
					return yield* Effect.die( new Error(
						`swish tests: the table never satisfied the predicate within ${ deadline }ms`
					) );
				}

				yield* Effect.sleep( Duration.millis( 10 ) );
			}
		} )
	} as const;
} );


/** A built table, for a helper that takes one. */
export type Table<Structure extends { readonly name: string }> =
	Effect.Success<ReturnType<typeof makeTable<Structure>>>;


// --- Assertions ------------------------------------------------------------

/**
 * Runs an effect that is expected to be refused, and hands back the refusal.
 *
 * Every refusal in `src/swish/errors.ts` is a `Schema.TaggedError`, so its
 * `_tag` is the whole contract — which is why this returns the error rather
 * than asserting on it: a test names the tag it wanted and can go on to read
 * the fields, and a *successful* call fails loudly instead of passing silently.
 *
 * @param effect - The call that should be refused.
 * @returns The typed failure.
 */
export const rejection = <A, E, R>( effect: Effect.Effect<A, E, R> ) => Effect.gen( function* () {
	const exit = yield* Effect.exit( effect );

	if ( Exit.isSuccess( exit ) ) {
		return yield* Effect.die( new Error(
			"swish tests: expected the call to be refused, but it succeeded"
		) );
	}

	const failure = exit.cause.reasons.find( Cause.isFailReason );
	if ( !failure ) {
		return yield* Effect.die( new Error(
			`swish tests: expected a typed refusal, got a defect: ${ Cause.pretty( exit.cause ) }`
		) );
	}

	return failure.error;
} );

/** The `_tag` of a refusal, for the common case of asserting only that. */
export const rejectionTag = <A, E, R>( effect: Effect.Effect<A, E, R> ) =>
	Effect.map( rejection( effect ), error => ( error as { _tag?: string } )._tag );
