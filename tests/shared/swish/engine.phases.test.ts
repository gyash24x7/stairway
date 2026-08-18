import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import type { PlayerId as Player } from "@/swish/shared/schema.ts";
import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import { commitsIn, createInput, runGame } from "@tests/helpers/runner.ts";
import type { RelayConfig } from "@tests/helpers/games/relay.ts";
import { ghostNextPhaseEngine, ghostStartEngine, relayEngine } from "@tests/helpers/games/relay.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b, c, d ] = [ "a", "b", "c", "d" ].map( player );
const seats = [ a, b, c, d ];

const info = ( id: Player ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar" } );

const config = ( rounds = 1 ): RelayConfig =>
	( { playerCount: 4, autoStart: false, rounds } );

/** Seats four players at a relay table and starts it, then runs the body. */
const relay = <A, E>(
	body: ( engine: Effect.Success<typeof relayEngine> ) => Effect.Effect<A, E>,
	rounds = 1
) => runGame( relayEngine, engine => Effect.gen( function* () {
	yield* engine.initialize( createInput( config( rounds ) ) );
	yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
	yield* engine.start( a );
	return yield* body( engine );
} ) );

/** Plays one full `passing` phase: every seat passes once, in rotation. */
const passRound = ( engine: Effect.Success<typeof relayEngine> ) =>
	Effect.forEach( seats, () => Effect.gen( function* () {
		const view = yield* engine.getState();
		yield* engine.pass( {}, view.context.currentPlayer );
	} ) );

/** Plays one full `collecting` phase, whoever the turn happens to sit with. */
const collectRound = ( engine: Effect.Success<typeof relayEngine>, amount = 1 ) =>
	Effect.forEach( seats, () => Effect.gen( function* () {
		const view = yield* engine.getState();
		yield* engine.collect( { amount }, view.context.currentPlayer );
	} ) );


describe( "entering the first phase", () => {
	test( "start puts the game in the phase it declares", () => {
		const { result } = relay( engine => engine.getState() );

		expect( result.context.phase ).toBe( "passing" );
	} );

	test( "the phase's entry hook runs, after the game's start hook", () => {
		const { result } = relay( engine => engine.getState() );

		expect( result.view.trace ).toEqual( [ "start", "enter:passing" ] );
	} );

	test( "the phase chooses who opens", () => {
		const { result } = relay( engine => engine.getState() );

		expect( result.context.currentPlayer ).toBe( a );
	} );

	test( "all of it lands in the start commit", () => {
		const { cells } = relay( engine => engine.getState() );
		const start = commitsIn( cells ).find( commit => commit.command === "start" );
		const tags = start?.events.map( event => event._tag ) ?? [];

		expect( tags ).toContain( "swish/ev/PhaseEntered" );
		expect( tags.indexOf( "swish/ev/PhaseEntered" ) )
			.toBeLessThan( tags.indexOf( "swish/ev/StatusChanged" ) );
	} );
} );


describe( "the moves a phase allows", () => {
	test( "refuses a move belonging to another phase", () => {
		const { result } = relay( engine => engine.collect( { amount: 1 }, a ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/MoveNotAllowed" );
		expect( ( result as { move: string } ).move ).toBe( "collect" );
	} );

	test( "allows the move the phase names", () => {
		const { result } = relay( engine => Effect.gen( function* () {
			yield* engine.pass( {}, a );
			return yield* engine.getState();
		} ) );

		expect( result.view.passes ).toEqual( [ a ] );
	} );

	test( "the gate follows the phase: what was refused becomes legal after the switch", () => {
		const { result } = relay( engine => Effect.gen( function* () {
			yield* passRound( engine );
			const view = yield* engine.getState();
			yield* engine.collect( { amount: 3 }, view.context.currentPlayer );
			return yield* engine.getState();
		} ) );

		expect( result.context.phase ).toBe( "collecting" );
		expect( result.view.collects ).toHaveLength( 1 );
	} );
} );


describe( "who acts next inside a phase", () => {
	test( "a phase with its own resolution follows it", () => {
		const { result } = relay( engine => Effect.gen( function* () {
			const order: Array<Player> = [];
			for ( let turn = 0; turn < 3; turn++ ) {
				const view = yield* engine.getState();
				order.push( view.context.currentPlayer );
				yield* engine.pass( {}, view.context.currentPlayer );
			}
			return order;
		} ) );

		expect( result ).toEqual( [ a, b, c ] );
	} );

	test( "a phase without one leaves the turn exactly where it was", () => {
		// `collecting` declares no `resolveNextPlayer`, so whoever entered it holds
		// the turn for the whole phase. That is the documented behaviour, and this
		// is the only place it can be seen.
		const { result } = relay( engine => Effect.gen( function* () {
			yield* passRound( engine );
			const entered = yield* engine.getState();

			const holders: Array<Player> = [];
			for ( let turn = 0; turn < 3; turn++ ) {
				const view = yield* engine.getState();
				holders.push( view.context.currentPlayer );
				yield* engine.collect( { amount: 1 }, view.context.currentPlayer );
			}

			return { entered: entered.context.currentPlayer, holders };
		} ) );

		expect( result.holders ).toEqual( [ result.entered, result.entered, result.entered ] );
	} );

	test( "the seat that ended a phase carries into the next one when it names no opener", () => {
		const { result } = relay( engine => Effect.gen( function* () {
			yield* passRound( engine );
			return yield* engine.getState();
		} ) );

		// `d` played the pass that ended the phase, and `collecting` chooses nobody.
		expect( result.context.currentPlayer ).toBe( d );
	} );
} );


describe( "leaving a phase", () => {
	test( "runs the exit hook, then records the exit, then enters the next", () => {
		const { result } = relay( engine => Effect.gen( function* () {
			yield* passRound( engine );
			return yield* engine.getState();
		} ) );

		expect( result.view.trace ).toEqual( [
			"start",
			"enter:passing",
			"exit:passing",
			"enter:collecting"
		] );
	} );

	test( "the exit and the entry ride the commit of the move that ended the phase", () => {
		const { cells } = relay( engine => passRound( engine ) );
		const tags = commitsIn( cells ).at( -1 )?.events.map( event => event._tag ) ?? [];

		expect( tags ).toContain( "swish/ev/PhaseExited" );
		expect( tags ).toContain( "swish/ev/PhaseEntered" );
		expect( tags.indexOf( "swish/ev/PhaseExited" ) )
			.toBeLessThan( tags.indexOf( "swish/ev/PhaseEntered" ) );
	} );

	test( "a phase may resolve back into one already played, round after round", () => {
		const { result } = relay( engine => Effect.gen( function* () {
			yield* passRound( engine );
			yield* collectRound( engine );
			return yield* engine.getState();
		} ), 2 );

		expect( result.view.round ).toBe( 1 );
		expect( result.context.phase ).toBe( "passing" );
		expect( result.view.trace.filter( note => note === "enter:passing" ) ).toHaveLength( 2 );
		// The re-entered phase chooses its opener again.
		expect( result.context.currentPlayer ).toBe( a );
	} );

	test( "the phase counters reset with the round", () => {
		const { result } = relay( engine => Effect.gen( function* () {
			yield* passRound( engine );
			yield* collectRound( engine );
			return yield* engine.getState();
		} ), 2 );

		expect( result.view.passes ).toEqual( [] );
		expect( result.view.collects ).toEqual( [] );
	} );
} );


describe( "a phase that ends the game", () => {
	test( "no further phase is entered", () => {
		const { result } = relay( engine => Effect.gen( function* () {
			yield* passRound( engine );
			yield* collectRound( engine );
			return yield* engine.getState();
		} ) );

		expect( result.status ).toBe( "COMPLETED" );
		expect( result.view.trace.filter( note => note === "enter:passing" ) ).toHaveLength( 1 );
	} );

	test( "the game's end hook runs after the phase's exit hook", () => {
		const { result } = relay( engine => Effect.gen( function* () {
			yield* passRound( engine );
			yield* collectRound( engine );
			return yield* engine.getState();
		} ) );

		expect( result.view.trace ).toEqual( [
			"start",
			"enter:passing",
			"exit:passing",
			"enter:collecting",
			"exit:collecting",
			"end"
		] );
	} );

	test( "the standings are resolved from the finished phase", () => {
		const { result } = relay( engine => Effect.gen( function* () {
			yield* passRound( engine );
			yield* collectRound( engine, 2 );
			return yield* engine.getState();
		} ) );

		// `d` entered `collecting` and held it, so it collected all four times.
		expect( result.results?.ranking[ 0 ] ).toMatchObject( { playerId: d, rank: 1, score: 8 } );
	} );
} );


describe( "a phase that does not exist", () => {
	test( "start refuses a game pointed at one", () => {
		const { result } = runGame( ghostStartEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config() ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			return yield* engine.start( a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/PhaseNotFound" );
		expect( ( result as { phase: string } ).phase ).toBe( "ghost" );
	} );

	test( "a start that failed leaves the game where it was", () => {
		const { result, cells } = runGame( ghostStartEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config() ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			yield* engine.start( a ).pipe( Effect.flip );
			return yield* engine.getState();
		} ) );

		expect( result.status ).toBe( "PLAYERS_READY" );
		expect( commitsIn( cells ).some( commit => commit.command === "start" ) ).toBe( false );
	} );

	test( "a move refuses when the phase it resolves into does not exist", () => {
		const { result } = runGame( ghostNextPhaseEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config() ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			yield* engine.start( a );
			return yield* engine.pass( {}, a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/PhaseNotFound" );
	} );

	test( "and the move it failed on is not committed", () => {
		const { result, cells } = runGame( ghostNextPhaseEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config() ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			yield* engine.start( a );
			yield* engine.pass( {}, a ).pipe( Effect.flip );
			return yield* engine.getState();
		} ) );

		expect( result.view.passes ).toEqual( [] );
		expect( commitsIn( cells ).some( commit => commit.moveType === "pass" ) ).toBe( false );
	} );
} );
