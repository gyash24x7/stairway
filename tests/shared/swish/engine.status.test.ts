import { tallyEngine } from "@tests/helpers/games/tally.ts";
import { createInput, runGame, testClock } from "@tests/helpers/runner.ts";
import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import type { PublishedStatus } from "@tests/helpers/host.ts";

import { GameId, PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";

import type { GameStatus } from "@/swish/shared/schema.ts";

const player = ( id: string ) => PlayerId.make( id );
const [ a, b, c, d ] = [ player( "a" ), player( "b" ), player( "c" ), player( "d" ) ];
const seats = [ a, b, c, d ];

const info = ( id: PlayerId ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar" } );

const config = ( autoStart: boolean ) => ( { playerCount: 4, autoStart } );

/** How long a full table waits before starting itself. */
const AUTO_START_DELAY_MS = 5_000;

/** The projections published, as `status seats/total @version`, for readable assertions. */
const summarize = ( statuses: ReadonlyArray<PublishedStatus> ) =>
	statuses.map( ( { projection } ) =>
		`${ projection.status } ${ projection.seatsTaken }/${ projection.playerCount } @${ projection.version }`
	);

const statusesOf = ( statuses: ReadonlyArray<PublishedStatus> ) =>
	statuses.map( ( { projection } ) => projection.status );


describe( "what a table publishes about itself", () => {
	test( "opening a table announces its shape before anyone has sat down", () => {
		// `initialize` is not a commit, and it is the only moment `playerCount`
		// becomes knowable from outside the object — so it has to announce.
		const { statuses } = runGame( tallyEngine, engine =>
			engine.initialize( createInput( config( false ), a ) ) );

		expect( summarize( statuses ) ).toEqual( [ "CREATED 0/4 @0" ] );
		expect( statuses[ 0 ]?.address ).toEqual( { game: "tally", id: GameId.make( "game-1" ) } );
	} );

	test( "every seat taken is announced, and the last one readies the table", () => {
		const { statuses } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config( false ), a ) );
			for ( const seat of seats ) {
				yield* engine.join( info( seat ) );
			}
		} ) );

		expect( summarize( statuses ) ).toEqual( [
			"CREATED 0/4 @0",
			"CREATED 1/4 @1",
			"CREATED 2/4 @2",
			"CREATED 3/4 @3",
			"PLAYERS_READY 4/4 @4"
		] );
	} );

	test( "a table that starts itself fills up while still reading CREATED", () => {
		// The case the lobby's `seatsTaken < playerCount` test exists for: under
		// `autoStart` the last join arms a timer instead of emitting a status, so a
		// full table sits at CREATED for the few seconds before it starts. Listing on
		// status alone would advertise it as joinable during exactly that window.
		const { statuses } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config( true ), a ) );
			for ( const seat of seats ) {
				yield* engine.join( info( seat ) );
			}
		} ) );

		expect( summarize( statuses ).at( -1 ) ).toBe( "CREATED 4/4 @4" );
		expect( statusesOf( statuses ) ).not.toContain( "PLAYERS_READY" );
	} );

	test( "starting is announced once", () => {
		const { statuses } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config( false ), a ) );
			for ( const seat of seats ) {
				yield* engine.join( info( seat ) );
			}
			yield* engine.start( a );
		} ) );

		expect( summarize( statuses ).at( -1 ) ).toBe( "IN_PROGRESS 4/4 @5" );
		expect( statusesOf( statuses ).filter( status => status === "IN_PROGRESS" ) ).toHaveLength( 1 );
	} );

	test( "a table that starts itself on its alarm announces that too", () => {
		const clock = testClock();

		const { statuses } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config( true ), a ) );
			for ( const seat of seats ) {
				yield* engine.join( info( seat ) );
			}

			clock.advance( AUTO_START_DELAY_MS + 1 );
			yield* engine.alarm();
		} ), { now: clock.now } );

		expect( summarize( statuses ).at( -1 ) ).toBe( "IN_PROGRESS 4/4 @5" );
	} );

	test( "bots filling the empty seats are announced like anyone else", () => {
		// The whole reason the count travels rather than being read back out of the
		// relational store, which never learns a bot exists.
		const { statuses } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config( false ), a ) );
			yield* engine.join( info( a ) );
			yield* engine.addBots( a );
		} ) );

		expect( summarize( statuses ) ).toEqual( [
			"CREATED 0/4 @0",
			"CREATED 1/4 @1",
			"CREATED 2/4 @2",
			"CREATED 3/4 @3",
			"PLAYERS_READY 4/4 @4"
		] );
	} );

	test( "playing does not announce anything", () => {
		// Otherwise a long game would be one queue message per move, all of them
		// carrying a projection that has not moved since the game started.
		const collected: Array<PublishedStatus> = [];

		const { result } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config( false ), a ) );
			for ( const seat of seats ) {
				yield* engine.join( info( seat ) );
			}
			yield* engine.start( a );

			const beforePlay = collected.length;

			yield* engine.score( { input: { points: 1 }, playerId: a } );
			yield* engine.score( { input: { points: 2 }, playerId: b } );

			return { beforePlay, afterPlay: collected.length };
		} ), { statuses: collected } );

		expect( result.beforePlay ).toBe( 6 );
		expect( result.afterPlay ).toBe( 6 );
	} );

	test( "finishing is not announced here — it travels with the archive", () => {
		// A status message flipping the row to COMPLETED could land before the archive
		// it points at, and the read path would send a reader somewhere empty.
		const { statuses, saved } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config( false ), a ) );
			for ( const seat of seats ) {
				yield* engine.join( info( seat ) );
			}
			yield* engine.start( a );

			for ( const seat of seats ) {
				yield* engine.score( { input: { points: 1 }, playerId: seat } );
			}
		} ) );

		expect( statusesOf( statuses ) ).not.toContain( "COMPLETED" );

		// The archive carries the completing version, and it is above every version
		// that was ever published as a status — which is what lets the store treat
		// `COMPLETED` as terminal without a second rule.
		const archived = saved.get( "tally:game-1" ) as { status: GameStatus; version: number };
		expect( archived.status ).toBe( "COMPLETED" );
		expect( archived.version ).toBeGreaterThan( statuses.at( -1 )!.projection.version );
	} );

	test( "taking a move back announces nothing, so the versions never go backwards", () => {
		// Undo rewinds the record's version, but it refuses outside the interval
		// strictly between the starting and completing commits — which is exactly the
		// interval nothing is published from. That is what makes the version a sound
		// last-write-wins guard downstream.
		const { statuses } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config( false ), a ) );
			for ( const seat of seats ) {
				yield* engine.join( info( seat ) );
			}
			yield* engine.start( a );

			yield* engine.score( { input: { points: 1 }, playerId: a } );
			yield* engine.undo( a );
			yield* engine.redo( a );
		} ) );

		expect( summarize( statuses ).at( -1 ) ).toBe( "IN_PROGRESS 4/4 @5" );

		const versions = statuses.map( ( { projection } ) => projection.version );
		expect( versions ).toEqual( [ ...versions ].sort( ( x, y ) => x - y ) );
		expect( new Set( versions ).size ).toBe( versions.length );
	} );

	test( "every announcement a table makes carries a strictly rising version", () => {
		const { statuses } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config( false ), a ) );
			for ( const seat of seats ) {
				yield* engine.join( info( seat ) );
			}
			yield* engine.start( a );

			for ( const seat of seats ) {
				yield* engine.score( { input: { points: 1 }, playerId: seat } );
			}
		} ) );

		const versions = statuses.map( ( { projection } ) => projection.version );

		expect( versions.length ).toBeGreaterThan( 1 );
		versions.forEach( ( version, index ) => {
			if ( index > 0 ) {
				expect( version ).toBeGreaterThan( versions[ index - 1 ]! );
			}
		} );
	} );

	test( "seats never exceed the table, so a full table is never offered as open", () => {
		const { statuses } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config( false ), a ) );
			for ( const seat of seats ) {
				yield* engine.join( info( seat ) );
			}
			// A re-join is a no-op and must not inflate the count.
			yield* engine.join( info( a ) );
		} ) );

		statuses.forEach( ( { projection } ) => {
			expect( projection.seatsTaken ).toBeLessThanOrEqual( projection.playerCount );
		} );

		const last = statuses.at( -1 )?.projection;
		expect( last?.seatsTaken ).toBe( 4 );
		expect( summarize( statuses ) ).toHaveLength( 5 );
	} );
} );
