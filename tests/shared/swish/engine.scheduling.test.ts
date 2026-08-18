import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import type { PlayerId as Player } from "@/swish/shared/schema.ts";
import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import { commitsIn, createInput, runGame, testClock } from "@tests/helpers/runner.ts";
import type { ParleyConfig } from "@tests/helpers/games/parley.ts";
import { parleyEngine, policylessParleyEngine } from "@tests/helpers/games/parley.ts";
import { relayEngine } from "@tests/helpers/games/relay.ts";
import type { ScribeConfig } from "@tests/helpers/games/scribe.ts";
import { scribeEngine } from "@tests/helpers/games/scribe.ts";
import type { TallyConfig } from "@tests/helpers/games/tally.ts";
import { tallyEngine } from "@tests/helpers/games/tally.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b, c, d ] = [ "a", "b", "c", "d" ].map( player );
const seats = [ a, b, c, d ];

const info = ( id: Player, isBot = false ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar", isBot } );

/** How long the engine waits before the policy plays a seat. */
const BOT_DELAY_MS = 5_000;

/** How long a full table waits before starting itself. */
const AUTO_START_DELAY_MS = 5_000;

const MOVE_TIMEOUT = 30_000;
const FRAME_TIMEOUT = 60_000;


// --- tally: a flat game with a bot policy ----------------------------------

const tallyConfig = ( over: Partial<TallyConfig> = {} ): TallyConfig =>
	( { playerCount: 4, autoStart: false, ...over } );

const tally = <A, E>(
	body: ( engine: Effect.Success<typeof tallyEngine> ) => Effect.Effect<A, E>,
	options: Parameters<typeof runGame>[ 2 ] & {
		readonly config?: Partial<TallyConfig>;
		readonly bots?: ReadonlyArray<Player>;
	} = {}
) => runGame( tallyEngine, engine => Effect.gen( function* () {
	yield* engine.initialize( createInput( tallyConfig( options.config ) ) );
	yield* Effect.forEach( seats, id =>
		engine.join( info( id, options.bots?.includes( id ) ?? false ) )
	);
	yield* engine.start( a );
	return yield* body( engine );
} ), options );


// --- scribe: a flat game with no policy at all -----------------------------

const scribeConfig = ( over: Partial<ScribeConfig> = {} ): ScribeConfig =>
	( { playerCount: 4, autoStart: false, allowSpecial: false, ...over } );

const scribe = <A, E>(
	body: ( engine: Effect.Success<typeof scribeEngine> ) => Effect.Effect<A, E>,
	options: Parameters<typeof runGame>[ 2 ] & {
		readonly config?: Partial<ScribeConfig>;
		readonly bots?: ReadonlyArray<Player>;
	} = {}
) => runGame( scribeEngine, engine => Effect.gen( function* () {
	yield* engine.initialize( createInput( scribeConfig( options.config ) ) );
	yield* Effect.forEach( seats, id =>
		engine.join( info( id, options.bots?.includes( id ) ?? false ) )
	);
	yield* engine.start( a );
	return yield* body( engine );
} ), options );


// --- parley: reaction windows, with and without a policy -------------------

const parleyConfig = ( over: Partial<ParleyConfig> = {} ): ParleyConfig =>
	( { playerCount: 4, autoStart: false, target: 99, ...over } );

const parleyOn = <A, E>(
	engine: typeof parleyEngine,
	body: ( built: Effect.Success<typeof parleyEngine> ) => Effect.Effect<A, E>,
	options: Parameters<typeof runGame>[ 2 ] & {
		readonly config?: Partial<ParleyConfig>;
		readonly bots?: ReadonlyArray<Player>;
	} = {}
) => runGame( engine, built => Effect.gen( function* () {
	yield* built.initialize( createInput( parleyConfig( options.config ) ) );
	yield* Effect.forEach( seats, id =>
		built.join( info( id, options.bots?.includes( id ) ?? false ) )
	);
	yield* built.start( a );
	return yield* body( built );
} ), options );


describe( "starting a table by itself", () => {
	test( "the last seat arms the delay, and nothing else", () => {
		const clock = testClock();

		const { pending } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput(
				tallyConfig( { autoStart: true, moveTimeoutMillis: MOVE_TIMEOUT } )
			) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
		} ), { now: clock.now } );

		// A game not yet in play is waiting on nobody's move.
		expect( [ ...pending.keys() ] ).toEqual( [ "auto-start" ] );
	} );

	test( "the alarm starts the game once the delay is up", () => {
		const clock = testClock();

		const { result } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig( { autoStart: true } ) ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			const waiting = yield* engine.getState();

			clock.advance( AUTO_START_DELAY_MS + 1 );
			yield* engine.alarm();

			return { waiting, started: yield* engine.getState() };
		} ), { now: clock.now } );

		expect( result.waiting.status ).toBe( "CREATED" );
		expect( result.started.status ).toBe( "IN_PROGRESS" );
	} );

	test( "a table already started by hand ignores the timer it beat", () => {
		const clock = testClock();

		const { result, cells } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig( { autoStart: true } ) ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			yield* engine.start( a );
			const started = yield* engine.getState();

			clock.advance( AUTO_START_DELAY_MS + 1 );
			yield* engine.alarm();

			return { started, after: yield* engine.getState() };
		} ), { now: clock.now } );

		expect( result.after.version ).toBe( result.started.version );
		expect( commitsIn( cells ).filter( commit => commit.command === "start" ) ).toHaveLength( 1 );
	} );

	test( "the timer survives the rearm every command performs", () => {
		const clock = testClock();

		const { pending } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig( { autoStart: true } ) ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			// `setAutoPlay` rearms the turn's clocks, which must leave this alone.
			yield* engine.setAutoPlay( a, true );
		} ), { now: clock.now } );

		expect( pending.has( "auto-start" ) ).toBe( true );
	} );
} );


describe( "the clocks a turn runs under", () => {
	test( "a human seat runs the move clock, and its deadline is published", () => {
		const clock = testClock();

		const { result, pending } = tally( engine => engine.getState(), {
			now: clock.now,
			config: { moveTimeoutMillis: MOVE_TIMEOUT }
		} );

		expect( [ ...pending.keys() ] ).toEqual( [ "move-timeout" ] );
		expect( result.deadline ).toBe( pending.get( "move-timeout" ) );
	} );

	test( "a machine-played seat runs the bot delay instead", () => {
		const clock = testClock();

		const { result, pending } = tally( engine => engine.getState(), {
			now: clock.now,
			bots: [ a ],
			config: { moveTimeoutMillis: MOVE_TIMEOUT }
		} );

		expect( [ ...pending.keys() ] ).toEqual( [ "bot" ] );
		// No move clock means nothing for that seat's client to count down.
		expect( result.deadline ).toBeUndefined();
	} );

	test( "a game with no policy never arms the bot, even for a bot seat", () => {
		const clock = testClock();

		const { pending } = scribe( engine => engine.getState(), {
			now: clock.now,
			bots: [ a ],
			config: { moveTimeoutMillis: MOVE_TIMEOUT }
		} );

		// Arming it would wake the host into nothing and strand the table.
		expect( pending.has( "bot" ) ).toBe( false );
		expect( pending.has( "move-timeout" ) ).toBe( true );
	} );

	test( "a table with no clocks configured arms nothing", () => {
		const clock = testClock();

		const { pending } = tally( engine => engine.getState(), { now: clock.now } );

		expect( pending.size ).toBe( 0 );
	} );

	test( "a finished game is waiting on nobody", () => {
		const clock = testClock();

		const { pending } = tally( engine => Effect.gen( function* () {
			for ( const seat of seats ) {
				yield* engine.score( { points: 1 }, seat );
			}
		} ), { now: clock.now, config: { moveTimeoutMillis: MOVE_TIMEOUT } } );

		expect( pending.size ).toBe( 0 );
	} );

	test( "each turn drops the clock the last one was running", () => {
		const clock = testClock();

		const { result, pending } = tally( engine => Effect.gen( function* () {
			const first = yield* engine.getState();
			clock.advance( 1_000 );
			yield* engine.score( { points: 1 }, a );
			return { first, second: yield* engine.getState() };
		} ), { now: clock.now, config: { moveTimeoutMillis: MOVE_TIMEOUT } } );

		expect( pending.size ).toBe( 1 );
		expect( result.second.deadline ).toBeGreaterThanOrEqual( result.first.deadline! );
	} );
} );


describe( "a move clock that runs out", () => {
	test( "with a policy, the seat is handed over rather than skipped", () => {
		const clock = testClock();

		const { result } = tally( engine => Effect.gen( function* () {
			const before = yield* engine.getState();
			clock.advance( MOVE_TIMEOUT + 1 );
			yield* engine.alarm();
			return { before, after: yield* engine.getState() };
		} ), { now: clock.now, config: { moveTimeoutMillis: MOVE_TIMEOUT } } );

		expect( result.after.autoPlay[ a ] ).toBe( true );
		// Handing a seat over is scheduling, not state: no commit, no version.
		expect( result.after.version ).toBe( result.before.version );
		expect( result.after.context.currentPlayer ).toBe( a );
	} );

	test( "and the policy then plays it on the next wake-up", () => {
		const clock = testClock();

		const { result } = tally( engine => Effect.gen( function* () {
			clock.advance( MOVE_TIMEOUT + 1 );
			yield* engine.alarm();
			const handed = yield* engine.getState();

			clock.advance( BOT_DELAY_MS + 1 );
			yield* engine.alarm();

			return { handed, played: yield* engine.getState() };
		} ), { now: clock.now, config: { moveTimeoutMillis: MOVE_TIMEOUT } } );

		expect( result.played.version ).toBe( result.handed.version + 1 );
		expect( result.played.view.points[ a ] ).toBe( 0 );
		expect( result.played.context.currentPlayer ).toBe( b );
	} );

	test( "the seat stays with the policy until its player takes it back", () => {
		const clock = testClock();

		const { result } = tally( engine => Effect.gen( function* () {
			clock.advance( MOVE_TIMEOUT + 1 );
			yield* engine.alarm();
			clock.advance( BOT_DELAY_MS + 1 );
			yield* engine.alarm();
			const afterPlay = yield* engine.getState();

			yield* engine.setAutoPlay( a, false );
			return { afterPlay, restored: yield* engine.getState() };
		} ), { now: clock.now, config: { moveTimeoutMillis: MOVE_TIMEOUT } } );

		expect( result.afterPlay.autoPlay[ a ] ).toBe( true );
		expect( result.restored.autoPlay[ a ] ).toBe( false );
	} );

	test( "without a policy the turn is skipped, and the seat is left alone", () => {
		const clock = testClock();

		const { result, cells } = scribe( engine => Effect.gen( function* () {
			const before = yield* engine.getState();
			clock.advance( MOVE_TIMEOUT + 1 );
			yield* engine.alarm();
			return { before, after: yield* engine.getState() };
		} ), { now: clock.now, config: { moveTimeoutMillis: MOVE_TIMEOUT } } );

		expect( result.after.context.currentPlayer ).toBe( b );
		expect( result.after.context.turn ).toBe( result.before.context.turn + 1 );
		// Telling the wire a seat is auto-played when nothing plays it would be a lie.
		expect( result.after.autoPlay ).toEqual( {} );
		expect( commitsIn( cells ).at( -1 )?.command ).toBe( "alarm" );
	} );

	test( "a skipped turn can be the thing that ends the game, and it is archived", () => {
		const clock = testClock();

		const { result, saved } = runGame( relayEngine, engine => Effect.gen( function* () {
			// A table whose end condition is already met the moment a turn ends.
			yield* engine.initialize( createInput( {
				playerCount: 4,
				autoStart: false,
				rounds: 0,
				moveTimeoutMillis: MOVE_TIMEOUT
			} ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			yield* engine.start( a );

			clock.advance( MOVE_TIMEOUT + 1 );
			yield* engine.alarm();

			return yield* engine.getState();
		} ), { now: clock.now } );

		expect( result.status ).toBe( "COMPLETED" );
		expect( saved.size ).toBe( 1 );
	} );

	test( "a seat already played by the machine is not timed out again", () => {
		const clock = testClock();

		const { result } = tally( engine => Effect.gen( function* () {
			const before = yield* engine.getState();
			clock.advance( MOVE_TIMEOUT + 1 );
			yield* engine.alarm();
			return { before, after: yield* engine.getState() };
		} ), { now: clock.now, bots: [ a ], config: { moveTimeoutMillis: MOVE_TIMEOUT } } );

		// A bot seat never ran a move clock, so the wake-up is the bot's.
		expect( result.after.autoPlay[ a ] ).toBeUndefined();
		expect( result.after.version ).toBe( result.before.version + 1 );
	} );
} );


describe( "the bot delay", () => {
	test( "plays a bot seat when it comes due", () => {
		const clock = testClock();

		const { result } = tally( engine => Effect.gen( function* () {
			const before = yield* engine.getState();
			clock.advance( BOT_DELAY_MS + 1 );
			yield* engine.alarm();
			return { before, after: yield* engine.getState() };
		} ), { now: clock.now, bots: [ a ] } );

		expect( result.after.view.points[ a ] ).toBe( 0 );
		expect( result.after.context.currentPlayer ).toBe( b );
	} );

	test( "plays a human seat that was handed over deliberately", () => {
		const clock = testClock();

		const { result } = tally( engine => Effect.gen( function* () {
			yield* engine.setAutoPlay( a, true );
			clock.advance( BOT_DELAY_MS + 1 );
			yield* engine.alarm();
			return yield* engine.getState();
		} ), { now: clock.now } );

		expect( result.view.points[ a ] ).toBe( 0 );
		expect( result.context.currentPlayer ).toBe( b );
	} );

	test( "a policy that declines to move leaves the table where it was", () => {
		const clock = testClock();

		const { result } = parleyOn( parleyEngine, engine => Effect.gen( function* () {
			const before = yield* engine.getState();
			clock.advance( BOT_DELAY_MS + 1 );
			yield* engine.alarm();
			return { before, after: yield* engine.getState() };
		} ), { now: clock.now, bots: [ a ], config: { passive: true } } );

		expect( result.after.version ).toBe( result.before.version );
	} );

	test( "nothing due means nothing happens", () => {
		const clock = testClock();

		const { result } = tally( engine => Effect.gen( function* () {
			const before = yield* engine.getState();
			yield* engine.alarm();
			return { before, after: yield* engine.getState() };
		} ), { now: clock.now, bots: [ a ] } );

		expect( result.after.version ).toBe( result.before.version );
	} );
} );


describe( "the clock an open frame runs", () => {
	const opened = <A, E>(
		engine: typeof parleyEngine,
		body: ( built: Effect.Success<typeof parleyEngine> ) => Effect.Effect<A, E>,
		options: Parameters<typeof parleyOn>[ 2 ] = {}
	) => parleyOn( engine, built => Effect.gen( function* () {
		yield* built.open( { kind: "duel" }, a );
		return yield* body( built );
	} ), options );

	test( "runs instead of the pending responder's move clock", () => {
		const clock = testClock();

		const { pending } = opened( parleyEngine, engine => engine.getState(), {
			now: clock.now,
			config: { interactionTimeoutMillis: FRAME_TIMEOUT, moveTimeoutMillis: MOVE_TIMEOUT }
		} );

		expect( [ ...pending.keys() ] ).toEqual( [ "interaction-timeout" ] );
	} );

	test( "runs alongside the bot delay when the machine answers", () => {
		const clock = testClock();

		const { pending } = opened( parleyEngine, engine => engine.getState(), {
			now: clock.now,
			bots: [ b ],
			config: { interactionTimeoutMillis: FRAME_TIMEOUT }
		} );

		expect( [ ...pending.keys() ].sort() ).toEqual( [ "bot", "interaction-timeout" ] );
	} );

	test( "a deadline already behind us is not armed", () => {
		// It belongs to a frame on its way to being settled, and waking at zero
		// would put the host in a loop.
		const clock = testClock();

		const { pending } = parleyOn( parleyEngine, engine => Effect.gen( function* () {
			yield* engine.open( { kind: "duel", deadline: 1 }, a );
			return yield* engine.getState();
		} ), { now: clock.now, config: { moveTimeoutMillis: MOVE_TIMEOUT } } );

		expect( pending.size ).toBe( 0 );
	} );

	test( "with a policy, every silent responder is handed over", () => {
		const clock = testClock();

		const { result } = opened( parleyEngine, engine => Effect.gen( function* () {
			yield* engine.reply( { value: true }, b );
			const before = yield* engine.getState();

			clock.advance( FRAME_TIMEOUT + 1 );
			yield* engine.alarm();

			return { before, after: yield* engine.getState() };
		} ), { now: clock.now, config: { interactionTimeoutMillis: FRAME_TIMEOUT } } );

		expect( result.after.autoPlay ).toEqual( { [ c ]: true, [ d ]: true } );
		// The responder who did answer keeps their seat.
		expect( result.after.autoPlay[ b ] ).toBeUndefined();
		expect( result.after.version ).toBe( result.before.version );
	} );

	test( "and the policy then answers for them", () => {
		const clock = testClock();

		const { result } = opened( parleyEngine, engine => Effect.gen( function* () {
			clock.advance( FRAME_TIMEOUT + 1 );
			yield* engine.alarm();

			for ( let turn = 0; turn < 3; turn++ ) {
				clock.advance( BOT_DELAY_MS + 1 );
				yield* engine.alarm();
			}

			return yield* engine.getState();
		} ), { now: clock.now, config: { interactionTimeoutMillis: FRAME_TIMEOUT } } );

		expect( result.context.interactions ).toEqual( [] );
		expect( result.view.log ).toContain( "resolved:duel:3" );
	} );

	test( "without a policy the frame is force-settled through its resolution", () => {
		const clock = testClock();

		const { result, cells } = opened( policylessParleyEngine, engine => Effect.gen( function* () {
			yield* engine.reply( { value: true }, b );
			clock.advance( FRAME_TIMEOUT + 1 );
			yield* engine.alarm();
			return yield* engine.getState();
		} ), { now: clock.now, config: { interactionTimeoutMillis: FRAME_TIMEOUT } } );

		// `duel` has no `onTimeout`, so `resolve` runs on the one answer that came in.
		expect( result.view.log ).toContain( "resolved:duel:1" );
		expect( result.context.interactions ).toEqual( [] );
		expect( commitsIn( cells ).at( -1 )?.command ).toBe( "alarm" );
	} );

	test( "an interaction with its own timeout settles through that instead", () => {
		const clock = testClock();

		const { result } = parleyOn( policylessParleyEngine, engine => Effect.gen( function* () {
			yield* engine.open( { kind: "vote" }, a );
			yield* engine.reply( { value: true }, b );
			// `vote` overrides the config with a five-second window of its own.
			clock.advance( 5_001 );
			yield* engine.alarm();
			return yield* engine.getState();
		} ), { now: clock.now, config: { interactionTimeoutMillis: FRAME_TIMEOUT } } );

		expect( result.view.log ).toContain( "resolved:vote:timeout:1" );
		expect( result.context.interactions ).toEqual( [] );
	} );

	test( "a force-settle may hand off to a frame of its own rather than end the turn", () => {
		const clock = testClock();

		const { result, pending } = parleyOn(
			policylessParleyEngine,
			engine => Effect.gen( function* () {
				yield* engine.open( { kind: "duel", nest: true }, a );
				clock.advance( FRAME_TIMEOUT + 1 );
				yield* engine.alarm();
				return yield* engine.getState();
			} ),
			{ now: clock.now, config: { interactionTimeoutMillis: FRAME_TIMEOUT } }
		);

		// `duel` has no `onTimeout`, so `resolve` runs — and this one nests.
		expect( result.context.interactions.map( frame => frame.kind ) ).toEqual( [ "vote" ] );
		expect( result.context.turn ).toBe( 0 );
		// The frame it handed off to runs its own clock, so the table is not stranded.
		expect( [ ...pending.keys() ] ).toEqual( [ "interaction-timeout" ] );
	} );

	test( "a force-settle hands the turn on from whoever opened the frame", () => {
		const clock = testClock();

		const { result } = opened( policylessParleyEngine, engine => Effect.gen( function* () {
			clock.advance( FRAME_TIMEOUT + 1 );
			yield* engine.alarm();
			return yield* engine.getState();
		} ), { now: clock.now, config: { interactionTimeoutMillis: FRAME_TIMEOUT } } );

		expect( result.context.currentPlayer ).toBe( b );
		expect( result.context.turn ).toBe( 1 );
	} );

	test( "a force-settle can be what ends the game", () => {
		const clock = testClock();

		const { result, saved } = opened( policylessParleyEngine, engine => Effect.gen( function* () {
			clock.advance( FRAME_TIMEOUT + 1 );
			yield* engine.alarm();
			return yield* engine.getState();
		} ), { now: clock.now, config: { interactionTimeoutMillis: FRAME_TIMEOUT, target: 1 } } );

		expect( result.status ).toBe( "COMPLETED" );
		expect( saved.size ).toBe( 1 );
	} );
} );


describe( "handing a seat to the policy", () => {
	test( "is not a commit: neither the version nor the cursor moves", () => {
		const clock = testClock();
		const cells = new Map<string, unknown>();

		const { result } = tally( engine => Effect.gen( function* () {
			const before = yield* engine.getState();
			const cursor = cells.get( "log:cursor" );
			yield* engine.setAutoPlay( a, true );
			return { before, cursor, after: yield* engine.getState() };
		} ), { now: clock.now, cells } );

		expect( result.after.version ).toBe( result.before.version );
		expect( cells.get( "log:cursor" ) ).toBe( result.cursor );
		expect( result.after.autoPlay[ a ] ).toBe( true );
	} );

	test( "swaps the seat's move clock for the bot delay", () => {
		const clock = testClock();

		const { result, pending } = tally( engine => Effect.gen( function* () {
			yield* engine.setAutoPlay( a, true );
			return yield* engine.getState();
		} ), { now: clock.now, config: { moveTimeoutMillis: MOVE_TIMEOUT } } );

		expect( [ ...pending.keys() ] ).toEqual( [ "bot" ] );
		expect( result.deadline ).toBeUndefined();
	} );

	test( "taking it back restores the move clock", () => {
		const clock = testClock();

		const { result, pending } = tally( engine => Effect.gen( function* () {
			yield* engine.setAutoPlay( a, true );
			yield* engine.setAutoPlay( a, false );
			return yield* engine.getState();
		} ), { now: clock.now, config: { moveTimeoutMillis: MOVE_TIMEOUT } } );

		expect( [ ...pending.keys() ] ).toEqual( [ "move-timeout" ] );
		expect( result.deadline ).toBeNumber();
	} );

	test( "an undo cannot rewind it", () => {
		const clock = testClock();

		const { result } = tally( engine => Effect.gen( function* () {
			yield* engine.score( { points: 1 }, a );
			yield* engine.setAutoPlay( a, true );
			yield* engine.undo( a );
			return yield* engine.getState();
		} ), { now: clock.now } );

		expect( result.autoPlay[ a ] ).toBe( true );
	} );

	test( "refuses a game with no policy to hand it to", () => {
		const { result } = scribe( engine => engine.setAutoPlay( a, true ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/AutoPlayUnavailable" );
		expect( ( result as { game: string } ).game ).toBe( "scribe" );
	} );

	test( "but switching it off there always works", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.setAutoPlay( a, false );
			return yield* engine.getState();
		} ) );

		expect( result.autoPlay[ a ] ).toBe( false );
	} );

	test( "refuses a caller who holds no seat", () => {
		const { result } = tally(
			engine => engine.setAutoPlay( player( "stranger" ), true ).pipe( Effect.flip )
		);

		expect( result._tag ).toBe( "swish/NotAMember" );
	} );

	test( "publishes the switch, so every client sees who is being played for", () => {
		const published: Array<unknown> = [];
		const clock = testClock();

		tally( engine => engine.setAutoPlay( a, true ), { now: clock.now, published } );

		const push = published.at( -1 ) as { table: { autoPlay: Record<Player, boolean> } };

		expect( push.table.autoPlay[ a ] ).toBe( true );
	} );
} );


describe( "an alarm with nothing to do", () => {
	test( "does nothing on a game that never started", () => {
		const clock = testClock();

		const { result } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			const before = yield* engine.getState();

			clock.advance( 10 * MOVE_TIMEOUT );
			yield* engine.alarm();

			return { before, after: yield* engine.getState() };
		} ), { now: clock.now } );

		expect( result.after.version ).toBe( result.before.version );
	} );

	test( "does nothing on a finished game", () => {
		const clock = testClock();

		const { result } = tally( engine => Effect.gen( function* () {
			for ( const seat of seats ) {
				yield* engine.score( { points: 1 }, seat );
			}
			const done = yield* engine.getState();

			clock.advance( 10 * MOVE_TIMEOUT );
			yield* engine.alarm();

			return { done, after: yield* engine.getState() };
		} ), { now: clock.now, config: { moveTimeoutMillis: MOVE_TIMEOUT } } );

		expect( result.after.version ).toBe( result.done.version );
		expect( result.after.status ).toBe( "COMPLETED" );
	} );
} );
