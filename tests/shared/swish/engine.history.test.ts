import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import type { PlayerId as Player } from "@/swish/shared/schema.ts";
import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import { commitsIn, createInput, runGame, testClock } from "@tests/helpers/runner.ts";
import type { ScribeConfig } from "@tests/helpers/games/scribe.ts";
import { scribeEngine } from "@tests/helpers/games/scribe.ts";
import type { TallyConfig } from "@tests/helpers/games/tally.ts";
import { tallyEngine } from "@tests/helpers/games/tally.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b, c, d, e ] = [ "a", "b", "c", "d", "e" ].map( player );
const seats = [ a, b, c, d ];

const info = ( id: Player ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar" } );

const scribeConfig = ( over: Partial<ScribeConfig> = {} ): ScribeConfig =>
	( { playerCount: 4, autoStart: false, allowSpecial: false, ...over } );

const tallyConfig = ( over: Partial<TallyConfig> = {} ): TallyConfig =>
	( { playerCount: 4, autoStart: false, ...over } );

/**
 * Seats four players at a scribe table and starts it. `note` never ends a turn,
 * so one seat can lay down as many commits as a test needs — which is what makes
 * this the game for travelling the log.
 */
const scribe = <A, E>(
	body: ( engine: Effect.Success<typeof scribeEngine> ) => Effect.Effect<A, E>,
	options: Parameters<typeof runGame>[ 2 ] & { readonly config?: Partial<ScribeConfig> } = {}
) => runGame( scribeEngine, engine => Effect.gen( function* () {
	yield* engine.initialize( createInput( scribeConfig( options.config ) ) );
	yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
	yield* engine.start( a );
	return yield* body( engine );
} ), options );


describe( "undoing a move", () => {
	test( "rewinds the state, the version and the cursor together", () => {
		const { result, cells } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			const played = yield* engine.getState();
			yield* engine.undo( a );
			return { played, rewound: yield* engine.getState() };
		} ) );

		expect( result.played.view.notes[ a ] ).toBe( 1 );
		expect( result.rewound.view.notes[ a ] ).toBeUndefined();
		expect( result.rewound.version ).toBe( result.played.version - 1 );
		// `version === cursor + 1`, everywhere.
		expect( cells.get( "log:cursor" ) ).toBe( result.rewound.version - 1 );
	} );

	test( "leaves the log itself alone, so the move is still there to replay", () => {
		const { result, cells } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			yield* engine.undo( a );
			return yield* engine.getState();
		} ) );

		expect( cells.get( "log:count" ) ).toBe( result.version + 1 );
		expect( commitsIn( cells ).at( -1 )?.moveType ).toBe( "note" );
	} );

	test( "takes back only one move at a time", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			yield* engine.note( { text: "two" }, a );
			yield* engine.undo( a );
			return yield* engine.getState();
		} ) );

		expect( result.view.notes[ a ] ).toBe( 1 );
		expect( result.view.log ).toContain( `wrote:${ a }:one` );
		expect( result.view.log ).not.toContain( `wrote:${ a }:two` );
	} );

	test( "publishes the rewound state, so nobody is left looking at the move", () => {
		const published: Array<unknown> = [];

		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			const beforeUndo = published.length;
			yield* engine.undo( a );
			return { beforeUndo, afterUndo: published.length };
		} ), { published } );

		expect( result.afterUndo ).toBe( result.beforeUndo + 1 );
	} );

	test( "refuses a caller who holds no seat", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			return yield* engine.undo( e ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NotAMember" );
	} );
} );


describe( "what undo refuses", () => {
	test( "a game that has not started", () => {
		const { result } = runGame( scribeEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( scribeConfig() ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			return yield* engine.undo( a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NothingToUndo" );
	} );

	test( "the commit that started the game", () => {
		const { result } = scribe( engine => engine.undo( a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/NothingToUndo" );
	} );

	test( "a game that is already over", () => {
		const { result } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			yield* engine.start( a );
			for ( const seat of seats ) {
				yield* engine.score( { points: 1 }, seat );
			}
			return yield* engine.undo( d ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NothingToUndo" );
	} );

	test( "another player's move", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			return yield* engine.undo( b ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/UndoNotAllowed" );
		expect( result ).toMatchObject( { playerId: b } );
	} );

	test( "a move somebody has already played on top of", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.finish( {}, a );
			yield* engine.finish( {}, b );
			// `a` owns the commit below, but `b`'s is what sits at the cursor.
			return yield* engine.undo( a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/UndoNotAllowed" );
	} );

	test( "a commit that was nobody's move", () => {
		// A clock that ran out commits on the engine's own behalf, so there is no
		// player it could be authorized against.
		const clock = testClock();

		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			clock.advance( 31_000 );
			yield* engine.alarm();
			return yield* engine.undo( a ).pipe( Effect.flip );
		} ), { now: clock.now, config: { moveTimeoutMillis: 30_000 } } );

		expect( result._tag ).toBe( "swish/UndoNotAllowed" );
	} );
} );


describe( "redoing a move", () => {
	test( "puts back what undo took", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			const played = yield* engine.getState();
			yield* engine.undo( a );
			yield* engine.redo( a );
			return { played, replayed: yield* engine.getState() };
		} ) );

		expect( result.replayed.version ).toBe( result.played.version );
		expect( result.replayed.view ).toEqual( result.played.view );
		expect( result.replayed.context ).toEqual( result.played.context );
	} );

	test( "a round trip through both rebuilds the record from the log", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			yield* engine.note( { text: "two" }, a );
			yield* engine.finish( {}, a );
			const played = yield* engine.getState();
			yield* engine.undo( a );
			yield* engine.redo( a );
			return { played, rebuilt: yield* engine.getState() };
		} ) );

		expect( result.rebuilt ).toEqual( result.played );
	} );

	test( "refuses when the cursor is already at the newest commit", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			return yield* engine.redo( a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NothingToRedo" );
	} );

	test( "refuses a move that is not the caller's", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			yield* engine.undo( a );
			return yield* engine.redo( b ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/RedoNotAllowed" );
	} );

	test( "refuses a caller who holds no seat", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			yield* engine.undo( a );
			return yield* engine.redo( e ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NotAMember" );
	} );

	test( "refuses on a game that has not started", () => {
		const { result } = runGame( scribeEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( scribeConfig() ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			return yield* engine.redo( a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NothingToRedo" );
	} );
} );


describe( "committing after an undo", () => {
	test( "forks the history: the redo is gone", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			yield* engine.undo( a );
			yield* engine.note( { text: "other" }, a );
			return yield* engine.redo( a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NothingToRedo" );
	} );

	test( "the new move lands where the old one was", () => {
		const { result, cells } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			const before = yield* engine.getState();
			yield* engine.undo( a );
			yield* engine.note( { text: "other" }, a );
			return { before, after: yield* engine.getState() };
		} ) );

		expect( result.after.version ).toBe( result.before.version );
		expect( result.after.view.log ).toContain( `wrote:${ a }:other` );
		expect( result.after.view.log ).not.toContain( `wrote:${ a }:one` );
		expect( commitsIn( cells ).at( -1 )?.events.some(
			event => event._tag === "scribe/ev/Wrote"
		) ).toBe( true );
	} );

	test( "shrinking the count is what strands the suffix — nothing is deleted", () => {
		// A documented gap: the commits above the count stay in storage until the
		// log regrows over them.
		const { cells } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			yield* engine.note( { text: "two" }, a );
			yield* engine.undo( a );
			yield* engine.undo( a );
			yield* engine.note( { text: "other" }, a );
		} ) );

		const count = cells.get( "log:count" ) as number;

		expect( cells.has( `log:commit:${ count }` ) ).toBe( true );
		expect( commitsIn( cells ).length ).toBeGreaterThan( count );
	} );

	test( "a commit at or past the count is never read back", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			yield* engine.note( { text: "two" }, a );
			yield* engine.undo( a );
			yield* engine.undo( a );
			yield* engine.note( { text: "other" }, a );
			return yield* engine.getState();
		} ) );

		expect( result.view.notes[ a ] ).toBe( 1 );
		expect( result.view.log ).not.toContain( `wrote:${ a }:two` );
	} );
} );


describe( "undo and the clocks", () => {
	test( "drops whatever was pending and arms the rewound turn afresh", () => {
		const clock = testClock();

		const { pending } = scribe( engine => Effect.gen( function* () {
			yield* engine.finish( {}, a );
			yield* engine.undo( a );
		} ), { now: clock.now, config: { moveTimeoutMillis: 30_000 } } );

		// One move clock, for the seat the rewind handed the turn back to.
		expect( [ ...pending.keys() ] ).toEqual( [ "move-timeout" ] );
	} );

	test( "a rewind cannot resurrect a spent deadline", () => {
		const clock = testClock();

		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.finish( {}, a );
			yield* engine.undo( a );
			return yield* engine.getState();
		} ), { now: clock.now, config: { moveTimeoutMillis: 30_000 } } );

		expect( result.deadline ).toBeGreaterThan( Date.now() );
	} );
} );
