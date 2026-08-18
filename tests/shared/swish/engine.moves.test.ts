import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import type { PlayerId as Player } from "@/swish/shared/schema.ts";
import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import { commitsIn, createInput, runGame } from "@tests/helpers/runner.ts";
import type { TallyConfig } from "@tests/helpers/games/tally.ts";
import { reversedTallyEngine, tallyEngine } from "@tests/helpers/games/tally.ts";
import type { NoteInput, ScribeConfig } from "@tests/helpers/games/scribe.ts";
import { scribeEngine } from "@tests/helpers/games/scribe.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b, c, d, e ] = [ "a", "b", "c", "d", "e" ].map( player );
const seats = [ a, b, c, d ];

const info = ( id: Player ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar" } );

const scribeConfig = ( over: Partial<ScribeConfig> = {} ): ScribeConfig =>
	( { playerCount: 4, autoStart: false, allowSpecial: false, ...over } );

/**
 * Seats four players at a scribe table and starts it, then runs the body. Scribe
 * declares one move for every way a move can differ, so most of this file is
 * driven through it.
 */
const scribe = <A, E>(
	body: ( engine: Effect.Success<typeof scribeEngine> ) => Effect.Effect<A, E>,
	config: Partial<ScribeConfig> = {}
) => runGame( scribeEngine, engine => Effect.gen( function* () {
	yield* engine.initialize( createInput( scribeConfig( config ) ) );
	yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
	yield* engine.start( a );
	return yield* body( engine );
} ) );

const tallyConfig = ( over: Partial<TallyConfig> = {} ): TallyConfig =>
	( { playerCount: 4, autoStart: false, ...over } );


describe( "who may move", () => {
	test( "the current player may", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.finish( {}, a );
			return yield* engine.getState();
		} ) );

		expect( result.view.finished ).toEqual( [ a ] );
	} );

	test( "refuses anyone else, and names who the table is waiting on", () => {
		const { result } = scribe( engine => engine.finish( {}, b ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/NotYourTurn" );
		expect( result ).toMatchObject( { playerId: b, currentPlayer: a } );
	} );

	test( "refuses someone who holds no seat", () => {
		const { result } = scribe( engine => engine.finish( {}, e ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/NotAMember" );
	} );

	test( "a move with its own canMove may be played out of turn", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.peek( {}, c );
			return yield* engine.getState();
		} ) );

		expect( result.view.log ).toContain( `peek:${ c }` );
		// Peeking costs nobody the turn.
		expect( result.context.currentPlayer ).toBe( a );
	} );

	test( "refuses a move before the game is in play", () => {
		const { result } = runGame( scribeEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( scribeConfig() ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			return yield* engine.finish( {}, a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/GameNotInProgress" );
		expect( ( result as { status: string } ).status ).toBe( "PLAYERS_READY" );
	} );

	test( "refuses a move once the game is over", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			for ( const seat of seats ) {
				yield* engine.finish( {}, seat );
			}
			return yield* engine.peek( {}, a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/GameNotInProgress" );
		expect( ( result as { status: string } ).status ).toBe( "COMPLETED" );
	} );
} );


describe( "seats that are out of play", () => {
	test( "a folded seat may not move again", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.fold( {}, a );
			// Even `peek`, which anyone may play at any time, is barred.
			return yield* engine.peek( {}, a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/MoveNotAllowed" );
		expect( ( result as { move: string } ).move ).toBe( "peek" );
	} );

	test( "the rotation skips it", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.fold( {}, a );
			const afterFold = yield* engine.getState();
			yield* engine.fold( {}, afterFold.context.currentPlayer );
			return yield* engine.getState();
		} ) );

		// a folded and handed over to b; b folded and the turn skipped past a to c.
		expect( result.context.seats ).toEqual( { [ a ]: "folded", [ b ]: "folded" } );
		expect( result.context.currentPlayer ).toBe( c );
	} );

	test( "with nobody left to act the turn stays where it was", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			for ( let turn = 0; turn < seats.length; turn++ ) {
				const view = yield* engine.getState();
				yield* engine.fold( {}, view.context.currentPlayer );
			}
			return yield* engine.getState();
		} ) );

		expect( Object.values( result.context.seats ) )
			.toEqual( [ "folded", "folded", "folded", "folded" ] );
		expect( result.context.currentPlayer ).toBe( d );
	} );
} );


describe( "moves the config switches off", () => {
	test( "refuses a move this table was not created with", () => {
		const { result } = scribe( engine => engine.special( {}, a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/MoveNotAllowed" );
		expect( ( result as { move: string } ).move ).toBe( "special" );
	} );

	test( "allows it when the config asks for it", () => {
		const { result } = scribe(
			engine => Effect.gen( function* () {
				yield* engine.special( {}, a );
				return yield* engine.getState();
			} ),
			{ allowSpecial: true }
		);

		expect( result.view.log ).toContain( `special:${ a }` );
	} );

	test( "the gate is central: even a seat whose turn it is not is refused the same way", () => {
		const { result } = scribe( engine => engine.special( {}, b ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/MoveNotAllowed" );
	} );
} );


describe( "input and validation", () => {
	test( "an input the schema refuses never reaches the game", () => {
		const { result, cells } = scribe( engine =>
			engine.note( { text: 7 } as unknown as NoteInput, a ).pipe( Effect.flip )
		);

		expect( result._tag ).toBe( "swish/InvalidMove" );
		expect( ( result as { move: string } ).move ).toBe( "note" );
		expect( commitsIn( cells ).some( commit => commit.moveType === "note" ) ).toBe( false );
	} );

	test( "a rejected move commits nothing", () => {
		const { result, cells } = scribe( engine => Effect.gen( function* () {
			const before = yield* engine.getState();
			yield* engine.note( { text: "" }, a ).pipe( Effect.flip );
			const after = yield* engine.getState();
			return { before, after };
		} ) );

		expect( result.after.version ).toBe( result.before.version );
		expect( commitsIn( cells ).some( commit => commit.moveType === "note" ) ).toBe( false );
	} );

	test( "the events the before-move hook already produced are discarded with it", () => {
		// The hook runs before `validate`, so its events exist in the accumulator
		// when the move is refused — and must go nowhere.
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "" }, a ).pipe( Effect.flip );
			return yield* engine.getState();
		} ) );

		expect( result.view.log ).not.toContain( "before:note" );
	} );

	test( "carries the game's own reason", () => {
		const { result } = scribe( engine => engine.note( { text: "" }, a ).pipe( Effect.flip ) );

		expect( ( result as { reason: string } ).reason ).toBe( "A note needs text." );
	} );
} );


describe( "hooks around a move", () => {
	test( "runs before the move, then the move, then after it", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "hello" }, a );
			return yield* engine.getState();
		} ) );

		const log = result.view.log;
		const before = log.indexOf( "before:note" );
		const wrote = log.indexOf( `wrote:${ a }:hello` );
		const after = log.indexOf( "after:note" );

		expect( before ).toBeGreaterThanOrEqual( 0 );
		expect( before ).toBeLessThan( wrote );
		expect( wrote ).toBeLessThan( after );
	} );

	test( "runs the end hook once, as the game completes", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			for ( const seat of seats ) {
				yield* engine.finish( {}, seat );
			}
			return yield* engine.getState();
		} ) );

		expect( result.view.log.filter( entry => entry === "end" ) ).toHaveLength( 1 );
		expect( result.status ).toBe( "COMPLETED" );
	} );

	test( "the hooks fire for an out-of-turn move too", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.peek( {}, c );
			return yield* engine.getState();
		} ) );

		expect( result.view.log ).toContain( "before:peek" );
		expect( result.view.log ).toContain( "after:peek" );
	} );
} );


describe( "whether a move ends the turn", () => {
	test( "a move declared not to leaves the turn and the counter alone", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			const before = yield* engine.getState();
			yield* engine.note( { text: "one" }, a );
			yield* engine.note( { text: "two" }, a );
			const after = yield* engine.getState();
			return { before, after };
		} ) );

		expect( result.after.context.currentPlayer ).toBe( a );
		expect( result.after.context.turn ).toBe( result.before.context.turn );
		expect( result.after.view.notes[ a ] ).toBe( 2 );
	} );

	test( "a move that does hands the turn on and counts it", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			const before = yield* engine.getState();
			yield* engine.finish( {}, a );
			const after = yield* engine.getState();
			return { before, after };
		} ) );

		expect( result.after.context.currentPlayer ).toBe( b );
		expect( result.after.context.turn ).toBe( result.before.context.turn + 1 );
	} );

	test( "a move that decides per input keeps the turn when it says so", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.wager( { amount: 0 }, a );
			return yield* engine.getState();
		} ) );

		expect( result.context.currentPlayer ).toBe( a );
		expect( result.context.turn ).toBe( 0 );
	} );

	test( "and gives it up when it does not", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.wager( { amount: 5 }, a );
			return yield* engine.getState();
		} ) );

		expect( result.context.currentPlayer ).toBe( b );
		expect( result.context.turn ).toBe( 1 );
	} );

	test( "a game can still end on a move that does not end the turn", () => {
		// `endIf` is checked either way — only the rotation is skipped.
		const { result } = scribe( engine => Effect.gen( function* () {
			for ( const seat of seats.slice( 0, 3 ) ) {
				yield* engine.finish( {}, seat );
			}
			yield* engine.wager( { amount: 0 }, d );
			const stillOn = yield* engine.getState();
			yield* engine.finish( {}, d );
			return { stillOn, done: yield* engine.getState() };
		} ) );

		expect( result.stillOn.status ).toBe( "IN_PROGRESS" );
		expect( result.done.status ).toBe( "COMPLETED" );
	} );
} );


describe( "randomness inside a move", () => {
	const rollIn = ( log: ReadonlyArray<string> ) =>
		log.find( entry => entry.startsWith( "wager:" ) );

	test( "comes from the game's seed, so a move can roll for its outcome", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.wager( { amount: 5 }, a );
			return yield* engine.getState();
		} ) );

		expect( rollIn( result.view.log ) ).toMatch( /^wager:5:\d+$/ );
	} );

	test( "the outcome rides the event, so a rebuild reproduces it exactly", () => {
		// Replay folds events and never re-runs `execute`, which is what makes
		// randomness inside a move safe.
		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.wager( { amount: 5 }, a );
			const played = yield* engine.getState();
			yield* engine.undo( a );
			yield* engine.redo( a );
			return { played, rebuilt: yield* engine.getState() };
		} ) );

		expect( rollIn( result.rebuilt.view.log ) ).toBe( rollIn( result.played.view.log )! );
	} );

	test( "two tables roll differently, since each has a seed of its own", () => {
		const rolls = Array.from( { length: 4 }, () => {
			const { result } = scribe( engine => Effect.gen( function* () {
				yield* engine.wager( { amount: 5 }, a );
				return yield* engine.getState();
			} ) );

			return rollIn( result.view.log );
		} );

		expect( new Set( rolls ).size ).toBeGreaterThan( 1 );
	} );
} );


describe( "the turn order", () => {
	test( "goes round the table and wraps", () => {
		const { result } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			yield* engine.start( a );

			const order: Array<Player> = [];
			for ( const seat of seats ) {
				const view = yield* engine.getState();
				order.push( view.context.currentPlayer );
				yield* engine.score( { points: 1 }, seat );
			}

			return { order, final: yield* engine.getState() };
		} ) );

		expect( result.order ).toEqual( seats );
		// Four turns, and the fourth wrapped back to the opening seat.
		expect( result.final.context.turn ).toBe( 4 );
	} );

	test( "follows the game's own resolution when it declares one", () => {
		const { result } = runGame( reversedTallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			yield* engine.start( a );
			yield* engine.score( { points: 1 }, a );
			return yield* engine.getState();
		} ) );

		expect( result.context.currentPlayer ).toBe( d );
	} );
} );


describe( "what a move records", () => {
	test( "the commit names the command, the actor and the move", () => {
		const { cells } = scribe( engine => engine.finish( {}, a ) );
		const commit = commitsIn( cells ).at( -1 );

		expect( commit?.command ).toBe( "submitMove" );
		expect( commit?.actor ).toBe( a );
		expect( commit?.moveType ).toBe( "finish" );
	} );

	test( "one move is one commit, however many events it produced", () => {
		const { cells } = scribe( engine => engine.fold( {}, a ) );
		const commit = commitsIn( cells ).at( -1 );

		// The fold itself, the seat change, and the two hooks around them.
		expect( commit?.events.length ).toBeGreaterThan( 1 );
		expect( commitsIn( cells ).filter( entry => entry.moveType === "fold" ) ).toHaveLength( 1 );
	} );

	test( "the turn tail rides the same commit as the move", () => {
		const { cells } = scribe( engine => engine.finish( {}, a ) );
		const tags = commitsIn( cells ).at( -1 )?.events.map( event => event._tag ) ?? [];

		expect( tags ).toContain( "swish/ev/TurnAdvanced" );
		expect( tags ).toContain( "swish/ev/CurrentPlayerSet" );
	} );
} );
