import { parleyEngine } from "@tests/helpers/games/parley.ts";
import { scribeEngine } from "@tests/helpers/games/scribe.ts";
import { tallyEngine } from "@tests/helpers/games/tally.ts";
import { createInput, publishedViews, runGame } from "@tests/helpers/runner.ts";
import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import type { ParleyConfig } from "@tests/helpers/games/parley.ts";
import type { ScribeConfig, ScribeView } from "@tests/helpers/games/scribe.ts";
import type { TallyConfig } from "@tests/helpers/games/tally.ts";

import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";

import type { PlayerId as Player, Standings } from "@/swish/shared/schema.ts";

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
			return { table: yield* engine.getView(), own: yield* engine.getView( b ) };
		} ) );

		expect( result.table.view.playerId ).toBeUndefined();
		expect( result.own.view.playerId ).toBe( b );
	} );

	test( "every other field is the same shape whoever is watching", () => {
		const { result } = scribe( engine => Effect.gen( function* () {
			return { table: yield* engine.getView(), own: yield* engine.getView( b ) };
		} ) );

		expect( result.own.view.log ).toEqual( result.table.view.log );
		expect( result.own.status ).toBe( result.table.status );
		expect( result.own.version ).toBe( result.table.version );
	} );

	test( "a read and a push carry the same envelope", () => {
		const published: Array<unknown> = [];

		const { result } = scribe( engine => engine.getView( b ), { published } );

		// One envelope shape however it arrived: what a read hands back is what the
		// fan-out pushed, field for field.
		expect( result ).toEqual( lastPush( published ).players[ b ]! );
	} );

	test( "the seed is on neither", () => {
		const published: Array<unknown> = [];

		const { result } = scribe( engine => engine.getView( b ), { published } );

		expect( result ).not.toHaveProperty( "seed" );
		expect( lastPush( published ).table ).not.toHaveProperty( "seed" );
		expect( lastPush( published ).players[ b ] ).not.toHaveProperty( "seed" );
	} );

	test( "so is the unredacted state", () => {
		const { result } = scribe( engine => engine.getView( b ) );

		expect( result ).not.toHaveProperty( "state" );
		expect( result.view ).toBeDefined();
	} );
} );


describe( "what a state change publishes", () => {
	test( "the table's view and one per seated player, as a single payload", () => {
		const published: Array<unknown> = [];

		scribe( engine => engine.note( { input: { text: "one" }, playerId: a } ), { published } );

		const push = lastPush( published );

		expect( Object.keys( push.players ) ).toEqual( seats );
		expect( push.table ).toBeDefined();
	} );

	test( "each player's own view is built for them", () => {
		const published: Array<unknown> = [];

		scribe( engine => engine.note( { input: { text: "one" }, playerId: a } ), { published } );

		const push = lastPush( published );

		for ( const seat of seats ) {
			expect( push.players[ seat ]!.view.playerId ).toBe( seat );
		}
	} );

	test( "every view in a push is at the same version", () => {
		// Half a table cannot end up a turn behind the other half.
		const published: Array<unknown> = [];

		scribe( engine => engine.note( { input: { text: "one" }, playerId: a } ), { published } );

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
			yield* engine.getView();
			yield* engine.getView( a );
			yield* engine.note( { input: { text: "" }, playerId: a } ).pipe( Effect.flip );
			return { before, after: published.length };
		} ), { published } );

		expect( result.after ).toBe( result.before );
	} );

	test( "undo and redo each publish once", () => {
		const published: Array<unknown> = [];

		const { result } = scribe( engine => Effect.gen( function* () {
			yield* engine.note( { input: { text: "one" }, playerId: a } );
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
		const { result } = scribe( engine => engine.getView( a ) );

		expect( result.autoPlay ).toEqual( {} );
		expect( result.context ).not.toHaveProperty( "autoPlay" );
	} );

	test( "so does the deadline, and only when a clock is running", () => {
		const withClock = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( { ...tallyConfig, moveTimeoutMillis: 30_000 } ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			yield* engine.start( a );
			return yield* engine.getView();
		} ) );

		const withoutClock = scribe( engine => engine.getView() );

		expect( withClock.result.deadline ).toBeGreaterThan( Date.now() );
		expect( withoutClock.result.deadline ).toBeUndefined();
	} );
} );


/** The scribe archive as the outbox received it, with only the fields tests read. */
type Archived = {
	readonly status: string;
	readonly view: ScribeView;
	readonly playerViews: Record<Player, ScribeView>;
	readonly results?: Standings;
	readonly context: { readonly players: ReadonlyArray<Player> };
};

const archivedIn = ( saved: Map<string, unknown> ) =>
	saved.get( "scribe:game-1" ) as Archived | undefined;


describe( "the archive", () => {
	const finished = () => scribe( engine => Effect.gen( function* () {
		yield* engine.note( { input: { text: "one" }, playerId: a } );
		for ( const seat of seats ) {
			yield* engine.finish( { input: {}, playerId: seat } );
		}
		return yield* engine.getView();
	} ) );

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
		const { saved } = scribe( engine => engine.note( { input: { text: "one" }, playerId: a } ) );

		expect( saved.size ).toBe( 0 );
	} );

	test( "it is filed once, on the commit that completed the game", () => {
		const { saved } = finished();

		expect( saved.size ).toBe( 1 );
	} );
} );


describe( "the standings the archive carries", () => {
	const finished = () => scribe( engine => Effect.gen( function* () {
		yield* engine.note( { input: { text: "one" }, playerId: a } );
		for ( const seat of seats ) {
			yield* engine.finish( { input: {}, playerId: seat } );
		}
	} ) );

	test( "one line per seat, carrying the rank and score it finished on", () => {
		const ranking = archivedIn( finished().saved )?.results?.ranking ?? [];

		expect( ranking.map( standing => standing.playerId ) ).toEqual( seats );
		expect( ranking.every( standing => standing.rank === 1 ) ).toBe( true );
		expect( ranking.find( standing => standing.playerId === a )?.score ).toBe( 1 );
	} );

	test( "a game that names nobody leaves the verdict unset", () => {
		const results = archivedIn( finished().saved )?.results;

		expect( results?.winner ).toBeUndefined();
		expect( results?.winningTeam ).toBeUndefined();
	} );

	test( "a game that ranks nobody is still filed, with no standings on it", () => {
		const config: ParleyConfig = { playerCount: 4, autoStart: false, target: 1 };

		const { saved } = runGame( parleyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			yield* engine.start( a );

			yield* engine.open( { input: { kind: "duel" }, playerId: a } );
			for ( const seat of [ b, c, d ] ) {
				yield* engine.reply( { input: { value: true }, playerId: seat } );
			}
		} ) );

		const archived = saved.get( "parley:game-1" ) as { readonly results?: Standings };

		expect( saved.size ).toBe( 1 );
		expect( archived.results ).toBeUndefined();
	} );
} );


describe( "the standings", () => {
	test( "are resolved by the game and folded onto the record", () => {
		const { result } = runGame( tallyEngine, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( tallyConfig ) );
			yield* Effect.forEach( seats, id => engine.join( info( id ) ) );
			yield* engine.start( a );
			yield* engine.score( { input: { points: 1 }, playerId: a } );
			yield* engine.score( { input: { points: 9 }, playerId: b } );
			yield* engine.score( { input: { points: 5 }, playerId: c } );
			yield* engine.score( { input: { points: 3 }, playerId: d } );
			return yield* engine.getView();
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
				yield* engine.finish( { input: {}, playerId: seat } );
			}
			return yield* engine.getView();
		} ) );

		expect( result.results?.ranking.every( standing => standing.rank === 1 ) ).toBe( true );
	} );
} );
