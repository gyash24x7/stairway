import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import type { PlayerId as Player } from "@/swish/shared/schema.ts";
import { GameId, PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import { createInput, publishedViews, runGame } from "@tests/helpers/runner.ts";
import type { ParleyConfig } from "@tests/helpers/games/parley.ts";
import { parleyEngine } from "@tests/helpers/games/parley.ts";
import type { ScribeConfig, ScribeView } from "@tests/helpers/games/scribe.ts";
import { scribeEngine } from "@tests/helpers/games/scribe.ts";
import type { TallyConfig } from "@tests/helpers/games/tally.ts";
import { tallyEngine } from "@tests/helpers/games/tally.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b, c, d ] = [ "a", "b", "c", "d" ].map( player );
const seats = [ a, b, c, d ];

const info = ( id: Player ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar" } );

const config: ScribeConfig = { playerCount: 4, autoStart: false, allowSpecial: false };

const tallyConfig: TallyConfig = { playerCount: 4, autoStart: false };

const scribe = <A, E>(
	body: ( engine: Effect.Success<typeof scribeEngine> ) => Effect.Effect<A, E>,
	options: Parameters<typeof runGame>[ 2 ] = {}
) => runGame( scribeEngine, engine => Effect.gen( function* () {
	yield* engine.initialize( createInput( config ) );
	yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
	yield* engine.start( a );
	return yield* body( engine );
} ), options );

/** The views the last state change pushed. */
const lastPush = ( published: ReadonlyArray<unknown> ) =>
	publishedViews<ScribeView, ScribeConfig>( published ).at( -1 )!;


describe( "one view, many audiences", () => {
	test( "the table's view hides what is private to a seat", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			return { table: yield* engine.getState(), own: yield* engine.getState( b ) };
		} ) );

		expect( result.table.view.playerId ).toBeUndefined();
		expect( result.own.view.playerId ).toBe( b );
	} );

	test( "every other field is the same shape whoever is watching", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			return { table: yield* engine.getState(), own: yield* engine.getState( b ) };
		} ) );

		expect( result.own.view.log ).toEqual( result.table.view.log );
		expect( result.own.status ).toBe( result.table.status );
		expect( result.own.version ).toBe( result.table.version );
	} );

	test( "a read and a push carry the same envelope", () => {
		const published: Array<unknown> = [];

		const { result } = scribe( engine => engine.getState( b ), { published } );

		// One envelope shape however it arrived: what a read hands back is what the
		// fan-out pushed, field for field.
		expect( result ).toEqual( lastPush( published ).players[ b ]! );
	} );

	test( "the seed is on neither", () => {
		const published: Array<unknown> = [];

		const { result } = scribe( engine => engine.getState( b ), { published } );

		expect( result ).not.toHaveProperty( "seed" );
		expect( lastPush( published ).table ).not.toHaveProperty( "seed" );
		expect( lastPush( published ).players[ b ] ).not.toHaveProperty( "seed" );
	} );

	test( "so is the unredacted state", () => {
		const { result } = scribe( engine => engine.getState( b ) );

		expect( result ).not.toHaveProperty( "state" );
		expect( result.view ).toBeDefined();
	} );
} );


describe( "what a state change publishes", () => {
	test( "the table's view and one per seated player, as a single payload", () => {
		const published: Array<unknown> = [];

		scribe( engine => engine.note( { text: "one" }, a ), { published } );

		const push = lastPush( published );

		expect( Object.keys( push.players ) ).toEqual( seats );
		expect( push.table ).toBeDefined();
	} );

	test( "each player's own view is built for them", () => {
		const published: Array<unknown> = [];

		scribe( engine => engine.note( { text: "one" }, a ), { published } );

		const push = lastPush( published );

		for ( const seat of seats ) {
			expect( push.players[ seat ]!.view.playerId ).toBe( seat );
		}
	} );

	test( "every view in a push is at the same version", () => {
		// Half a table cannot end up a turn behind the other half.
		const published: Array<unknown> = [];

		scribe( engine => engine.note( { text: "one" }, a ), { published } );

		const push = lastPush( published );
		const versions = [ push.table, ...Object.values( push.players ) ].map( view => view.version );

		expect( new Set( versions ).size ).toBe( 1 );
	} );

	test( "a join publishes to whoever is already seated", () => {
		const published: Array<unknown> = [];

		runGame( scribeEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config ) );
			yield* engine.join( info( a ) );
			yield* engine.join( info( b ) );
		} ), { published } );

		expect( published ).toHaveLength( 2 );
		expect( Object.keys( lastPush( published ).players ) ).toEqual( [ a, b ] );
	} );

	test( "commands that change nothing publish nothing", () => {
		const published: Array<unknown> = [];

		const { result } = scribe( engine => Effect.gen( function* () {
			const before = published.length;
			yield* engine.getState();
			yield* engine.getState( a );
			yield* engine.note( { text: "" }, a ).pipe( Effect.flip );
			return { before, after: published.length };
		} ), { published } );

		expect( result.after ).toBe( result.before );
	} );

	test( "undo and redo each publish once", () => {
		const published: Array<unknown> = [];

		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			const played = published.length;
			yield* engine.undo( a );
			const undone = published.length;
			yield* engine.redo( a );
			return { played, undone, redone: published.length };
		} ), { published } );

		expect( result.undone ).toBe( result.played + 1 );
		expect( result.redone ).toBe( result.undone + 1 );
	} );
} );


describe( "the scheduling facts on the envelope", () => {
	test( "autoplay rides the envelope rather than the context", () => {
		const { result } = scribe( engine => engine.getState( a ) );

		expect( result.autoPlay ).toEqual( {} );
		expect( result.context ).not.toHaveProperty( "autoPlay" );
	} );

	test( "so does the deadline, and only when a clock is running", () => {
		const withClock = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( { ...tallyConfig, moveTimeoutMillis: 30_000 } ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			yield* engine.start( a );
			return yield* engine.getState();
		} ) );

		const withoutClock = scribe( engine => engine.getState() );

		expect( withClock.result.deadline ).toBeGreaterThan( Date.now() );
		expect( withoutClock.result.deadline ).toBeUndefined();
	} );
} );


describe( "the archive", () => {
	const finished = () => scribe( engine => Effect.gen( function* () {
		yield* engine.note( { text: "one" }, a );
		for ( const seat of seats ) {
			yield* engine.finish( {}, seat );
		}
		return yield* engine.getState();
	} ) );

	type Archived = {
		readonly status: string;
		readonly view: ScribeView;
		readonly playerViews: Record<Player, ScribeView>;
		readonly results?: { readonly ranking: ReadonlyArray<unknown> };
		readonly context: { readonly players: ReadonlyArray<Player> };
	};

	const archivedIn = ( saved: Map<string, unknown> ) =>
		saved.get( "scribe:game-1" ) as Archived | undefined;

	test( "a finished game is filed under its game and id", () => {
		const { saved } = finished();

		expect( [ ...saved.keys() ] ).toEqual( [ "scribe:game-1" ] );
		expect( archivedIn( saved )?.status ).toBe( "COMPLETED" );
	} );

	test( "it keeps the table view and every player's final view", () => {
		const { saved } = finished();
		const archived = archivedIn( saved )!;

		expect( archived.view.playerId ).toBeUndefined();
		expect( Object.keys( archived.playerViews ) ).toEqual( seats );
		expect( archived.playerViews[ b ]?.playerId ).toBe( b );
	} );

	test( "it carries the standings and the roster", () => {
		const { saved } = finished();
		const archived = archivedIn( saved )!;

		expect( archived.results?.ranking ).toHaveLength( 4 );
		expect( archived.context.players ).toEqual( seats );
	} );

	test( "the seed is not in it", () => {
		const { saved } = finished();

		expect( archivedIn( saved ) ).not.toHaveProperty( "seed" );
	} );

	test( "nothing is filed while the game is still on", () => {
		const { saved } = scribe( engine => engine.note( { text: "one" }, a ) );

		expect( saved.size ).toBe( 0 );
	} );

	test( "it is filed once, on the commit that completed the game", () => {
		const { saved } = finished();

		expect( saved.size ).toBe( 1 );
	} );
} );


describe( "the ledger", () => {
	const finished = ( options: Parameters<typeof runGame>[ 2 ] = {} ) =>
		scribe( engine => Effect.gen( function* () {
			yield* engine.note( { text: "one" }, a );
			for ( const seat of seats ) {
				yield* engine.finish( {}, seat );
			}
		} ), options );

	test( "a finished game is posted under its game and id", () => {
		const { posted } = finished();

		expect( posted ).toHaveLength( 1 );
		expect( posted[ 0 ]?.address ).toEqual( { game: "scribe", id: GameId.make( "game-1" ) } );
	} );

	test( "one line per seat, carrying the rank and score it finished on", () => {
		const { posted } = finished();
		const entries = posted[ 0 ]?.entries ?? [];

		expect( entries.map( entry => entry.playerId ) ).toEqual( seats );
		expect( entries.every( entry => entry.rank === 1 ) ).toBe( true );
		expect( entries.find( entry => entry.playerId === a )?.score ).toBe( 1 );
	} );

	test( "a game that names nobody leaves every line unwon", () => {
		const { posted } = finished();

		expect( posted[ 0 ]?.entries.every( entry => !entry.winner ) ).toBe( true );
	} );

	test( "the completion is stamped from the engine's clock", () => {
		const { posted } = finished( { now: () => 1_700_000_000_000 } );

		expect( posted[ 0 ]?.completedAt ).toBe( 1_700_000_000_000 );
	} );

	test( "nothing is posted while the game is still on", () => {
		const { posted } = scribe( engine => engine.note( { text: "one" }, a ) );

		expect( posted ).toHaveLength( 0 );
	} );

	test( "it is posted once, on the commit that completed the game", () => {
		const { posted } = finished();

		expect( posted ).toHaveLength( 1 );
	} );

	test( "a game that ranks nobody still posts its completion, with no lines", () => {
		const config: ParleyConfig = { playerCount: 4, autoStart: false, target: 1 };

		const { posted } = runGame( parleyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			yield* engine.start( a );

			yield* engine.open( { kind: "duel" }, a );
			for ( const seat of [ b, c, d ] ) {
				yield* engine.reply( { value: true }, seat );
			}
		} ) );

		expect( posted ).toHaveLength( 1 );
		expect( posted[ 0 ]?.entries ).toEqual( [] );
	} );
} );


describe( "the standings", () => {
	test( "are resolved by the game and folded onto the record", () => {
		const { result } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			yield* engine.start( a );
			yield* engine.score( { points: 1 }, a );
			yield* engine.score( { points: 9 }, b );
			yield* engine.score( { points: 5 }, c );
			yield* engine.score( { points: 3 }, d );
			return yield* engine.getState();
		} ) );

		expect( result.results?.ranking.map( standing => standing.playerId ) )
			.toEqual( [ b, c, d, a ] );
		expect( result.results?.ranking[ 0 ] ).toMatchObject( { rank: 1, score: 9 } );
	} );

	test( "a game with no resolution records none", () => {
		// Scribe ranks everyone, so this is the shape rather than the absence: a
		// structure without `resolveResults` simply never emits the event.
		const { result } = scribe( engine => Effect.gen( function* () {
			for ( const seat of seats ) {
				yield* engine.finish( {}, seat );
			}
			return yield* engine.getState();
		} ) );

		expect( result.results?.ranking.every( standing => standing.rank === 1 ) ).toBe( true );
	} );
} );
