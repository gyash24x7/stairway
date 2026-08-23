import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import type { PlayerId as Player } from "@/swish/shared/schema.ts";
import { GameCode, GameId, GameRef, PlayerId, PlayerInfo, TeamId }
	from "@/swish/shared/schema.ts";
import { commitsIn, createInput, publishedViews, runGame } from "@tests/helpers/runner.ts";
import type { TallyConfig, TallyView } from "@tests/helpers/games/tally.ts";
import { tallyEngine } from "@tests/helpers/games/tally.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ a, b, c, d, e ] = [ "a", "b", "c", "d", "e" ].map( player );

const info = ( id: Player ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar" } );

const config = ( over: Partial<TallyConfig> = {} ): TallyConfig =>
	( { playerCount: 2, autoStart: false, ...over } );

const refTo = ( id: string, code: string ) =>
	GameRef.make( { id: GameId.make( id ), code: GameCode.make( code ) } );

const NEXT = refTo( "game-2", "NEXT" );
const OTHER = refTo( "game-3", "OTHR" );

const run = <A, E>(
	body: ( engine: Effect.Success<typeof tallyEngine> ) => Effect.Effect<A, E>,
	options?: Parameters<typeof runGame>[ 2 ]
) => runGame( tallyEngine, body, options );

/** Seats both players and plays the game out, so it ends `COMPLETED`. */
const playOut = ( engine: Effect.Success<typeof tallyEngine> ) => Effect.gen( function* () {
	yield* engine.initialize( createInput( config() ) );
	yield* engine.join( info( a ) );
	yield* engine.join( info( b ) );
	yield* engine.start( a );
	yield* engine.score( { points: 2 }, a );
	yield* engine.score( { points: 1 }, b );
} );


describe( "setRematch", () => {

	test( "records the game the table moved on to, and answers with it", () => {
		const { result, cells } = run( engine => Effect.gen( function* () {
			yield* playOut( engine );
			return yield* engine.setRematch( a, NEXT );
		} ) );

		expect( result ).toEqual( NEXT );
		expect( cells.get( "prefs:rematch" ) ).toEqual( NEXT );
	} );

	test( "puts the pointer on the envelope every audience reads", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* playOut( engine );
			yield* engine.setRematch( a, NEXT );

			return {
				table: yield* engine.getState(),
				seat: yield* engine.getState( a )
			};
		} ) );

		expect( result.table.rematch ).toEqual( NEXT );
		expect( result.seat.rematch ).toEqual( NEXT );
	} );

	test( "carries no pointer before anyone has asked", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* playOut( engine );
			return yield* engine.getState( a );
		} ) );

		expect( result.rematch ).toBeUndefined();
	} );

	test( "pushes it to the table and to every seat", () => {
		const { published } = run( engine => Effect.gen( function* () {
			yield* playOut( engine );
			yield* engine.setRematch( a, NEXT );
		} ) );

		const views = publishedViews<TallyView, TallyConfig>( published );
		const last = views[ views.length - 1 ]!;

		expect( last.table.rematch ).toEqual( NEXT );
		expect( last.players[ a ]?.rematch ).toEqual( NEXT );
		expect( last.players[ b ]?.rematch ).toEqual( NEXT );
	} );

	test( "is write-once: a second asker is handed the first one's game", () => {
		const { result, cells } = run( engine => Effect.gen( function* () {
			yield* playOut( engine );
			yield* engine.setRematch( a, NEXT );
			return yield* engine.setRematch( b, OTHER );
		} ) );

		// Everyone lands in the same game — the second ref is answered, not stored.
		expect( result ).toEqual( NEXT );
		expect( cells.get( "prefs:rematch" ) ).toEqual( NEXT );
	} );

	test( "commits nothing: the finished game's history is untouched", () => {
		const { result, cells } = run( engine => Effect.gen( function* () {
			yield* playOut( engine );
			const before = yield* engine.getState( a );
			yield* engine.setRematch( a, NEXT );
			return { before, after: yield* engine.getState( a ) };
		} ) );

		expect( result.after.version ).toBe( result.before.version );
		expect( commitsIn( cells ).length ).toBe( result.before.version );
	} );

	test( "arms no clock — a finished game is waiting on nobody", () => {
		const { pending } = run( engine => Effect.gen( function* () {
			yield* playOut( engine );
			yield* engine.setRematch( a, NEXT );
		} ) );

		expect( [ ...pending.keys() ] ).toEqual( [] );
	} );

	test( "refuses a game that has not finished", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config() ) );
			yield* engine.join( info( a ) );
			yield* engine.join( info( b ) );
			yield* engine.start( a );
			return yield* engine.setRematch( a, NEXT ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/RematchUnavailable" );
		expect( ( result as { status: string } ).status ).toBe( "IN_PROGRESS" );
	} );

	test( "refuses a game still filling up", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config() ) );
			yield* engine.join( info( a ) );
			return yield* engine.setRematch( a, NEXT ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/RematchUnavailable" );
		expect( ( result as { status: string } ).status ).toBe( "CREATED" );
	} );

	test( "refuses a caller who never sat at the table", () => {
		const { result, cells } = run( engine => Effect.gen( function* () {
			yield* playOut( engine );
			return yield* engine.setRematch( e, NEXT ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NotAMember" );
		expect( cells.get( "prefs:rematch" ) ).toBeUndefined();
	} );

	test( "lives outside the log, beside the other facts undo cannot reach", () => {
		const { cells } = run( engine => Effect.gen( function* () {
			yield* playOut( engine );
			yield* engine.setRematch( a, NEXT );
		} ) );

		// Under `prefs:`, where autoplay lives — not under `log:` and not folded into
		// the record. Nothing that replays or rewinds history can touch it.
		expect( cells.get( "prefs:rematch" ) ).toEqual( NEXT );

		const inLog = commitsIn( cells )
			.flatMap( commit => commit.events.map( event => event._tag ) )
			.some( tag => tag.toLowerCase().includes( "rematch" ) );

		expect( inLog ).toBe( false );
	} );
} );


describe( "leaveTeam", () => {

	const team = ( id: string ) => TeamId.make( id );

	const RED = team( "red" );
	const BLUE = team( "blue" );

	const teamed = (): TallyConfig =>
		( { playerCount: 4, autoStart: false, teams: [ RED, BLUE ] } );

	test( "frees a seat on a side that was full", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( teamed() ) );
			yield* Effect.forEach( [ a, b, c, d ], id => engine.join( info( id ) ) );

			yield* engine.joinTeam( a, RED );
			yield* engine.joinTeam( b, RED );

			// `red` holds both its seats, so `c` cannot take one...
			const refused = yield* engine.joinTeam( c, RED ).pipe( Effect.flip );

			// ...until somebody steps off it.
			yield* engine.leaveTeam( b );
			yield* engine.joinTeam( c, RED );

			const state = yield* engine.getState( a );
			return { refused, teams: state.context.teams };
		} ) );

		expect( result.refused._tag ).toBe( "swish/TeamFull" );
		expect( result.teams[ b ] ).toBeUndefined();
		expect( result.teams[ c ] ).toBe( RED );
	} );

	test( "does nothing for a caller who holds no side", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( teamed() ) );
			yield* Effect.forEach( [ a, b, c, d ], id => engine.join( info( id ) ) );

			const before = yield* engine.getState( a );
			yield* engine.leaveTeam( a );
			return { before, after: yield* engine.getState( a ) };
		} ) );

		expect( result.after.version ).toBe( result.before.version );
	} );

	test( "refuses a game that declares no sides", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config() ) );
			yield* engine.join( info( a ) );
			return yield* engine.leaveTeam( a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/TeamsUnavailable" );
	} );

	test( "refuses once the game has started, when sides are already seated", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( teamed() ) );
			yield* Effect.forEach( [ a, b, c, d ], id => engine.join( info( id ) ) );
			yield* engine.start( a );
			return yield* engine.leaveTeam( a ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/GameNotJoinable" );
	} );

	test( "refuses a caller who holds no seat", () => {
		const { result } = run( engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( teamed() ) );
			yield* Effect.forEach( [ a, b, c, d ], id => engine.join( info( id ) ) );
			return yield* engine.leaveTeam( e ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/NotAMember" );
	} );
} );
