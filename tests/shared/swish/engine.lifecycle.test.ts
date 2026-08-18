import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import type { PlayerId as Player } from "@/swish/shared/schema.ts";
import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import { commitsIn, createInput, runGame } from "@tests/helpers/runner.ts";
import type { ScribeConfig } from "@tests/helpers/games/scribe.ts";
import { scribeEngine } from "@tests/helpers/games/scribe.ts";
import type { TallyConfig } from "@tests/helpers/games/tally.ts";
import { tallyEngine } from "@tests/helpers/games/tally.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b, c, d, e ] = [ "a", "b", "c", "d", "e" ].map( player );

const info = ( id: Player, isBot = false ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar", isBot } );

const tallyConfig = ( over: Partial<TallyConfig> = {} ): TallyConfig =>
	( { playerCount: 4, autoStart: false, ...over } );

const scribeConfig = ( over: Partial<ScribeConfig> = {} ): ScribeConfig =>
	( { playerCount: 4, autoStart: false, allowSpecial: false, ...over } );

const run = <A, E>(
	body: ( engine: Effect.Success<typeof tallyEngine> ) => Effect.Effect<A, E>,
	options?: Parameters<typeof runGame>[ 2 ]
) => runGame( tallyEngine, body, options );

/** Seats every player named, in order. */
const seatAll = (
	engine: Effect.Success<typeof tallyEngine>,
	players: ReadonlyArray<Player>
) => Effect.forEach( players, id => engine.join( info( id ) ) );


describe( "initialize", () => {
	test( "answers with the game's id and code", () => {
		const { result } = run( engine => engine.initialize( createInput( tallyConfig() ) ) );

		expect( String( result.id ) ).toBe( "game-1" );
		expect( String( result.code ) ).toBe( "CODE" );
	} );

	test( "writes a genesis log: an empty history under a materialized record", () => {
		const { cells } = run( engine => engine.initialize( createInput( tallyConfig() ) ) );

		expect( cells.get( "log:count" ) ).toBe( 0 );
		expect( cells.get( "log:cursor" ) ).toBe( -1 );
		// The base and the record start life as the same value: nothing has been
		// folded yet, so there is nothing to tell them apart.
		expect( cells.get( "log:base" ) ).toEqual( cells.get( "data" ) );
	} );

	test( "starts at version 0, with no seats taken", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			return yield* engine.getState();
		} ) );

		expect( result.version ).toBe( 0 );
		expect( result.status ).toBe( "CREATED" );
		expect( result.players ).toEqual( {} );
		expect( result.context.players ).toEqual( [] );
		expect( result.context.turn ).toBe( 0 );
	} );

	test( "seats the creator as the current player before anyone joins", () => {
		// `currentPlayer` is a branded non-empty string, so there is no blank to
		// stand in — the creator is what fills it until the first join does.
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig(), "zara" ) );
			return yield* engine.getState();
		} ) );

		expect( String( result.context.currentPlayer ) ).toBe( "zara" );
	} );

	test( "keeps the seed out of every form that leaves the engine", () => {
		const { result, cells } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			return yield* engine.getState();
		} ) );

		const stored = cells.get( "data" ) as { seed?: string };

		expect( stored.seed ).toBeString();
		expect( result ).not.toHaveProperty( "seed" );
	} );

	test( "runs the game's setup against that seed", () => {
		// Scribe's `setup` draws a number from the seed, so the value proves the
		// factory was handed a working rng rather than a stub.
		const { result } = runGame( scribeEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( scribeConfig() ) );
			return yield* engine.getState();
		} ) );

		expect( result.view.log[ 0 ] ).toMatch( /^setup:\d+$/ );
	} );

	test( "commits nothing — creating a game is not a move", () => {
		const { cells } = run( engine => engine.initialize( createInput( tallyConfig() ) ) );

		expect( commitsIn( cells ) ).toHaveLength( 0 );
	} );
} );


describe( "join", () => {
	test( "seats a player in the roster and the seating order", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* engine.join( info( a ) );
			yield* engine.join( info( b ) );
			return yield* engine.getState();
		} ) );

		expect( Object.keys( result.players ) ).toEqual( [ a, b ] );
		expect( result.context.players ).toEqual( [ a, b ] );
		expect( result.players[ a ]?.name ).toBe( "player a" );
	} );

	test( "answers with the game's ref, so a client learns the code by joining", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			return yield* engine.join( info( a ) );
		} ) );

		expect( result ).toEqual( { id: "game-1", code: "CODE" } as never );
	} );

	test( "the first seat taken becomes the current player", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig(), "zara" ) );
			yield* engine.join( info( b ) );
			return yield* engine.getState();
		} ) );

		expect( result.context.currentPlayer ).toBe( b );
	} );

	test( "a re-join is a no-op: no commit, no version, no duplicate seat", () => {
		const { result, cells } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* engine.join( info( a ) );
			const before = yield* engine.getState();
			yield* engine.join( info( a ) );
			const after = yield* engine.getState();
			return { before, after };
		} ) );

		expect( result.after.version ).toBe( result.before.version );
		expect( result.after.context.players ).toEqual( [ a ] );
		expect( commitsIn( cells ) ).toHaveLength( 1 );
	} );

	test( "refuses a seat once the table is full", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* seatAll( engine, [ a, b, c, d ] );
			return yield* engine.join( info( e ) ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/GameFull" );
		expect( ( result as { playerCount: number } ).playerCount ).toBe( 4 );
	} );

	test( "refuses a seat once the game is in progress", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig( { playerCount: 2 } ) ) );
			yield* seatAll( engine, [ a, b ] );
			yield* engine.start( a );
			return yield* engine.join( info( c ) ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/GameNotJoinable" );
		expect( ( result as { status: string } ).status ).toBe( "IN_PROGRESS" );
	} );

	test( "the last seat readies a table that does not start itself", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* seatAll( engine, [ a, b, c ] );
			const partial = yield* engine.getState();
			yield* engine.join( info( d ) );
			const full = yield* engine.getState();
			return { partial, full };
		} ) );

		expect( result.partial.status ).toBe( "CREATED" );
		expect( result.full.status ).toBe( "PLAYERS_READY" );
	} );

	test( "a table that starts itself stays CREATED and arms the delay instead", () => {
		const { result, pending } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig( { autoStart: true } ) ) );
			yield* seatAll( engine, [ a, b, c, d ] );
			return yield* engine.getState();
		} ) );

		expect( result.status ).toBe( "CREATED" );
		expect( pending.has( "auto-start" ) ).toBe( true );
	} );

	test( "arms nothing while seats remain", () => {
		const { pending } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig( { autoStart: true } ) ) );
			yield* seatAll( engine, [ a, b ] );
		} ) );

		expect( pending.has( "auto-start" ) ).toBe( false );
	} );

	test( "runs the join hook before the seat is recorded", () => {
		// The hook sees the table as it was, so a game may read the pre-join roster.
		const { cells } = runGame( scribeEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( scribeConfig() ) );
			yield* engine.join( info( a ) );
		} ) );

		const tags = commitsIn( cells )[ 0 ]?.events.map( event => event._tag ) ?? [];

		expect( tags ).toEqual( [ "scribe/ev/Noted", "swish/ev/PlayerJoined" ] );
	} );

	test( "records the join as a commit by that player", () => {
		const { cells } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* engine.join( info( a ) );
		} ) );

		expect( commitsIn( cells )[ 0 ]?.command ).toBe( "join" );
		expect( commitsIn( cells )[ 0 ]?.actor ).toBe( a );
	} );
} );


describe( "addBots", () => {
	test( "fills every remaining seat", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* engine.join( info( a ) );
			yield* engine.addBots( a );
			return yield* engine.getState();
		} ) );

		const roster = Object.values( result.players );

		expect( roster ).toHaveLength( 4 );
		expect( roster.filter( seat => seat.isBot ) ).toHaveLength( 3 );
		expect( result.status ).toBe( "PLAYERS_READY" );
	} );

	test( "fills nothing at a full table", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* seatAll( engine, [ a, b, c, d ] );
			const before = yield* engine.getState();
			yield* engine.addBots( a );
			const after = yield* engine.getState();
			return { before, after };
		} ) );

		expect( result.after.version ).toBe( result.before.version );
	} );

	test( "refuses a caller who holds no seat", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* engine.join( info( a ) );
			return yield* engine.addBots( b ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NotAMember" );
	} );

	test( "refuses once the game is in progress", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig( { playerCount: 2 } ) ) );
			yield* seatAll( engine, [ a, b ] );
			yield* engine.start( a );
			return yield* engine.addBots( a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/GameNotJoinable" );
	} );

	test( "gives every bot a distinct identity", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* engine.join( info( a ) );
			yield* engine.addBots( a );
			return yield* engine.getState();
		} ) );

		expect( new Set( Object.keys( result.players ) ).size ).toBe( 4 );
	} );
} );


describe( "start", () => {
	test( "puts a full table in play", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* seatAll( engine, [ a, b, c, d ] );
			yield* engine.start( a );
			return yield* engine.getState();
		} ) );

		expect( result.status ).toBe( "IN_PROGRESS" );
	} );

	test( "refuses a table with seats still open", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* seatAll( engine, [ a, b ] );
			return yield* engine.start( a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/CannotStart" );
		expect( ( result as { status: string } ).status ).toBe( "CREATED" );
	} );

	test( "refuses a game already in play", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig( { playerCount: 2 } ) ) );
			yield* seatAll( engine, [ a, b ] );
			yield* engine.start( a );
			return yield* engine.start( a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/CannotStart" );
	} );

	test( "refuses a finished game", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig( { playerCount: 2 } ) ) );
			yield* seatAll( engine, [ a, b ] );
			yield* engine.start( a );
			yield* engine.score( { points: 1 }, a );
			yield* engine.score( { points: 1 }, b );
			return yield* engine.start( a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/CannotStart" );
		expect( ( result as { status: string } ).status ).toBe( "COMPLETED" );
	} );

	test( "refuses a caller who holds no seat", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* seatAll( engine, [ a, b, c, d ] );
			return yield* engine.start( e ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NotAMember" );
	} );

	test( "runs the start hook against the game's seed, before play opens", () => {
		const { result, cells } = runGame( scribeEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( scribeConfig() ) );
			yield* Effect.forEach( [ a, b, c, d ], id => engine.join( info( id ) ) );
			yield* engine.start( a );
			return yield* engine.getState();
		} ) );

		const startCommit = commitsIn( cells ).find( commit => commit.command === "start" );
		const tags = startCommit?.events.map( event => event._tag ) ?? [];

		expect( result.view.log.some( entry => /^start:\d+$/.test( entry ) ) ).toBe( true );
		// The status change is last: the hook runs on a table not yet in play.
		expect( tags[ tags.length - 1 ] ).toBe( "swish/ev/StatusChanged" );
	} );

	test( "marks the commit that started the game, so undo can stop at it", () => {
		const { cells } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* seatAll( engine, [ a, b, c, d ] );
			yield* engine.start( a );
		} ) );

		// Four joins sit below it, so the start commit is index 4.
		expect( cells.get( "log:start-commit" ) ).toBe( 4 );
	} );

	test( "the start commit belongs to no one, since a table is not started by a move", () => {
		const { cells } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* seatAll( engine, [ a, b, c, d ] );
			yield* engine.start( a );
		} ) );

		const startCommit = commitsIn( cells ).find( commit => commit.command === "start" );

		expect( startCommit?.actor ).toBeUndefined();
	} );
} );


describe( "getState", () => {
	const started = <A, E>(
		body: ( engine: Effect.Success<typeof tallyEngine> ) => Effect.Effect<A, E>
	) => run( engine => Effect.gen( function* () {
		yield* engine.initialize( createInput( tallyConfig() ) );
		yield* seatAll( engine, [ a, b, c, d ] );
		yield* engine.start( a );
		return yield* body( engine );
	} ) );

	test( "the table's view names no player", () => {
		const { result } = started( engine => engine.getState() );

		expect( result.view.playerId ).toBeUndefined();
	} );

	test( "a player's view names them", () => {
		const { result } = started( engine => engine.getState( b ) );

		expect( result.view.playerId ).toBe( b );
	} );

	test( "refuses a private read to someone who holds no seat", () => {
		const { result } = started( engine => engine.getState( e ).pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/NotAMember" );
	} );

	test( "a table read needs no seat at all", () => {
		const { result } = started( engine => engine.getState() );

		expect( result.status ).toBe( "IN_PROGRESS" );
	} );

	test( "fails on a game that was never created", () => {
		const { result } = run( engine => engine.getState().pipe( Effect.flip ) );

		expect( result._tag ).toBe( "swish/GameNotFound" );
	} );

	test( "carries the scheduling facts that are not game state", () => {
		const { result } = started( engine => engine.getState() );

		expect( result.autoPlay ).toEqual( {} );
		expect( result.deadline ).toBeUndefined();
	} );

	test( "carries the config it was created with", () => {
		const { result } = started( engine => engine.getState() );

		expect( result.config.playerCount ).toBe( 4 );
		expect( result.config.autoStart ).toBe( false );
	} );
} );


describe( "cleanup", () => {
	test( "erases the game", () => {
		const { result, cells } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* seatAll( engine, [ a, b, c, d ] );
			yield* engine.start( a );
			yield* engine.cleanup();
			return yield* engine.getState().pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/GameNotFound" );
		expect( cells.size ).toBe( 0 );
	} );

	test( "cancels every pending timer", () => {
		const { pending } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig( { autoStart: true } ) ) );
			yield* seatAll( engine, [ a, b, c, d ] );
			yield* engine.cleanup();
		} ) );

		expect( pending.size ).toBe( 0 );
	} );

	test( "an alarm on an erased game does nothing", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig() ) );
			yield* engine.join( info( a ) );
			yield* engine.cleanup();
			return yield* engine.alarm();
		} ) );

		expect( result ).toBeUndefined();
	} );
} );
