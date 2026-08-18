import { describe, expect, test } from "bun:test";
import * as Effect from "effect/Effect";

import { tictactoe } from "@/games/tictactoe/server/engine.ts";
import type { PlaceInput, TicTacToeConfig } from "@/games/tictactoe/shared/schema.ts";
import {
	TICTACTOE_MOVE_TIMEOUT_MILLIS,
	TICTACTOE_PLAYER_COUNT
} from "@/games/tictactoe/shared/schema.ts";
import type { PlayerId as Player } from "@/swish/shared/schema.ts";
import { PlayerId, PlayerInfo } from "@/swish/shared/schema.ts";
import { createInput, runGame, testClock } from "@tests/helpers/runner.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ x, o ] = [ player( "x" ), player( "o" ) ];

const info = ( id: Player, isBot = false ) =>
	PlayerInfo.make( { id, name: `player ${ id }`, avatar: "avatar", isBot } );

const config: TicTacToeConfig = {
	playerCount: TICTACTOE_PLAYER_COUNT,
	autoStart: true,
	moveTimeoutMillis: TICTACTOE_MOVE_TIMEOUT_MILLIS
};

/** How long a full table waits before starting itself. */
const AUTO_START_DELAY_MS = 5_000;

/** How long the engine waits before the policy plays a seat. */
const BOT_DELAY_MS = 5_000;

/**
 * Seats both players and lets the table start itself, which is how tic-tac-toe
 * runs: `autoStart` is fixed on rather than being a choice.
 *
 * @param body - What to play once the duel is under way.
 * @param [options] - The clock to drive it with, and which seats are bots.
 * @returns The run's result and collectors.
 */
const duel = <A, E>(
	body: ( engine: Effect.Success<typeof tictactoe> ) => Effect.Effect<A, E>,
	options: {
		readonly clock?: ReturnType<typeof testClock>;
		readonly bots?: ReadonlyArray<Player>;
	} = {}
) => {
	const clock = options.clock ?? testClock();

	return runGame( tictactoe, engine => Effect.gen( function* () {
		yield* engine.initialize( createInput( config, x ) );
		yield* engine.join( info( x, options.bots?.includes( x ) ?? false ) );
		yield* engine.join( info( o, options.bots?.includes( o ) ?? false ) );

		clock.advance( AUTO_START_DELAY_MS + 1 );
		yield* engine.alarm();

		return yield* body( engine );
	} ), { now: clock.now } );
};

/** Plays a run of cells, alternating seats from X. */
const playOut = ( engine: Effect.Success<typeof tictactoe>, cells: ReadonlyArray<number> ) =>
	Effect.forEach( cells, ( position, index ) =>
		engine.place( { position } as PlaceInput, index % 2 === 0 ? x : o )
	);


describe( "seating a duel", () => {
	test( "a full table starts itself", () => {
		const clock = testClock();

		const { result } = runGame( tictactoe, engine => Effect.gen( function* () {
			yield* engine.initialize( createInput( config, x ) );
			yield* engine.join( info( x ) );
			yield* engine.join( info( o ) );
			const waiting = yield* engine.getState();

			clock.advance( AUTO_START_DELAY_MS + 1 );
			yield* engine.alarm();

			return { waiting, started: yield* engine.getState() };
		} ), { now: clock.now } );

		expect( result.waiting.status ).toBe( "CREATED" );
		expect( result.started.status ).toBe( "IN_PROGRESS" );
	} );

	test( "the first seat plays X and the second O", () => {
		const { result } = duel( engine => engine.getState() );

		expect( result.view.symbols ).toEqual( { X: x, O: o } );
	} );

	test( "X opens", () => {
		const { result } = duel( engine => engine.getState() );

		expect( result.context.currentPlayer ).toBe( x );
		expect( result.status ).toBe( "IN_PROGRESS" );
	} );

	test( "the board starts empty and stays nine cells long", () => {
		const { result } = duel( engine => engine.getState() );

		expect( result.view.board ).toHaveLength( 9 );
		expect( result.view.board.every( cell => cell === null ) ).toBe( true );
	} );

	test( "the table has nothing to hide, so both views agree", () => {
		const { result } = duel( engine => Effect.gen( function* () {
			return { table: yield* engine.getState(), own: yield* engine.getState( x ) };
		} ) );

		expect( result.own.view.board ).toEqual( result.table.view.board );
		expect( result.table.view.playerId ).toBeUndefined();
		expect( result.own.view.playerId ).toBe( x );
	} );
} );


describe( "placing a mark", () => {
	test( "writes the caller's own symbol into the cell", () => {
		const { result } = duel( engine => Effect.gen( function* () {
			yield* engine.place( { position: 4 } as PlaceInput, x );
			return yield* engine.getState();
		} ) );

		expect( result.view.board[ 4 ] ).toBe( "X" );
	} );

	test( "hands the turn to the other seat", () => {
		const { result } = duel( engine => Effect.gen( function* () {
			yield* engine.place( { position: 4 } as PlaceInput, x );
			return yield* engine.getState();
		} ) );

		expect( result.context.currentPlayer ).toBe( o );
	} );

	test( "refuses a cell that is already taken", () => {
		const { result } = duel( engine => Effect.gen( function* () {
			yield* engine.place( { position: 4 } as PlaceInput, x );
			return yield* engine.place( { position: 4 } as PlaceInput, o ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/InvalidMove" );
		expect( ( result as { reason: string } ).reason ).toBe( "Cell is already occupied." );
	} );

	test( "refuses a seat playing out of turn", () => {
		const { result } = duel( engine =>
			engine.place( { position: 0 } as PlaceInput, o ).pipe( Effect.flip )
		);

		expect( result._tag ).toBe( "swish/NotYourTurn" );
	} );

	test( "refuses an index no cell owns, at the schema rather than the board", () => {
		// The bound lives on the input, so an out-of-range index never reaches
		// `validate` to be mistaken for an occupied cell.
		const { result } = duel( engine =>
			engine.place( { position: 9 } as PlaceInput, x ).pipe( Effect.flip )
		);

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );

	test( "refuses a fractional index the same way", () => {
		const { result } = duel( engine =>
			engine.place( { position: 1.5 } as PlaceInput, x ).pipe( Effect.flip )
		);

		expect( result._tag ).toBe( "swish/InvalidMove" );
	} );
} );


describe( "how a duel ends", () => {
	test( "a completed line ends it and names the winner", () => {
		const { result } = duel( engine => Effect.gen( function* () {
			// X takes the top row, O the middle two.
			yield* playOut( engine, [ 0, 3, 1, 4, 2 ] );
			return yield* engine.getState();
		} ) );

		expect( result.status ).toBe( "COMPLETED" );
		expect( result.results?.winner ).toBe( x );
	} );

	test( "the loser is ranked behind the winner", () => {
		const { result } = duel( engine => Effect.gen( function* () {
			yield* playOut( engine, [ 0, 3, 1, 4, 2 ] );
			return yield* engine.getState();
		} ) );

		const ranking = result.results?.ranking ?? [];

		expect( ranking.find( standing => standing.playerId === x )?.rank ).toBe( 1 );
		expect( ranking.find( standing => standing.playerId === o )?.rank ).toBe( 2 );
	} );

	test( "a full board with no line is a draw", () => {
		const { result } = duel( engine => Effect.gen( function* () {
			// X: 0,1,5,6,8   O: 2,3,4,7 — every cell taken, no line.
			yield* playOut( engine, [ 0, 2, 1, 3, 5, 4, 6, 7, 8 ] );
			return yield* engine.getState();
		} ) );

		expect( result.status ).toBe( "COMPLETED" );
		// A draw is an absence in the standings: nobody named, both seats level.
		expect( result.results?.winner ).toBeUndefined();
		expect( result.results?.ranking.every( standing => standing.rank === 1 ) ).toBe( true );
	} );

	test( "a finished duel refuses further play", () => {
		const { result } = duel( engine => Effect.gen( function* () {
			yield* playOut( engine, [ 0, 3, 1, 4, 2 ] );
			return yield* engine.place( { position: 8 } as PlaceInput, o ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/GameNotInProgress" );
	} );

	test( "the finished duel is archived with both seats' views", () => {
		const { saved } = duel( engine => playOut( engine, [ 0, 3, 1, 4, 2 ] ) );
		const archived = saved.get( "tictactoe:game-1" ) as
			undefined | { readonly playerViews: Record<Player, unknown> };

		expect( [ ...saved.keys() ] ).toEqual( [ "tictactoe:game-1" ] );
		expect( Object.keys( archived?.playerViews ?? {} ) ).toEqual( [ x, o ] );
	} );
} );


describe( "the bot", () => {
	test( "plays the seat when its delay comes due", () => {
		const clock = testClock();

		const { result } = duel( engine => Effect.gen( function* () {
			yield* engine.place( { position: 0 } as PlaceInput, x );
			clock.advance( BOT_DELAY_MS + 1 );
			yield* engine.alarm();
			return yield* engine.getState();
		} ), { clock, bots: [ o ] } );

		expect( result.view.board.filter( cell => cell === "O" ) ).toHaveLength( 1 );
		expect( result.context.currentPlayer ).toBe( x );
	} );

	test( "takes the centre against a corner opening", () => {
		const clock = testClock();

		const { result } = duel( engine => Effect.gen( function* () {
			yield* engine.place( { position: 0 } as PlaceInput, x );
			clock.advance( BOT_DELAY_MS + 1 );
			yield* engine.alarm();
			return yield* engine.getState();
		} ), { clock, bots: [ o ] } );

		expect( result.view.board[ 4 ] ).toBe( "O" );
	} );

	test( "two bots play each other to a draw", () => {
		const clock = testClock();

		const { result } = duel( engine => Effect.gen( function* () {
			for ( let turn = 0; turn < 12; turn++ ) {
				const view = yield* engine.getState();
				if ( view.status === "COMPLETED" ) {
					return view;
				}

				clock.advance( BOT_DELAY_MS + 1 );
				yield* engine.alarm();
			}

			return yield* engine.getState();
		} ), { clock, bots: [ x, o ] } );

		// Perfect play both ways can only be a draw.
		expect( result.status ).toBe( "COMPLETED" );
		expect( result.results?.winner ).toBeUndefined();
		expect( result.view.board.every( cell => cell !== null ) ).toBe( true );
	} );

	test( "a seat that runs out of time is handed to the bot, which plays it", () => {
		const clock = testClock();

		const { result } = duel( engine => Effect.gen( function* () {
			clock.advance( TICTACTOE_MOVE_TIMEOUT_MILLIS + 1 );
			yield* engine.alarm();
			const handed = yield* engine.getState();

			clock.advance( BOT_DELAY_MS + 1 );
			yield* engine.alarm();

			return { handed, played: yield* engine.getState() };
		} ), { clock } );

		expect( result.handed.autoPlay[ x ] ).toBe( true );
		expect( result.played.view.board.filter( cell => cell !== null ) ).toHaveLength( 1 );
		expect( result.played.context.currentPlayer ).toBe( o );
	} );
} );


describe( "taking a move back", () => {
	test( "a seat may take back its own last mark", () => {
		const { result } = duel( engine => Effect.gen( function* () {
			yield* engine.place( { position: 4 } as PlaceInput, x );
			yield* engine.undo( x );
			return yield* engine.getState();
		} ) );

		expect( result.view.board[ 4 ] ).toBeNull();
		expect( result.context.currentPlayer ).toBe( x );
	} );

	test( "but not the other seat's", () => {
		const { result } = duel( engine => Effect.gen( function* () {
			yield* engine.place( { position: 4 } as PlaceInput, x );
			return yield* engine.undo( o ).pipe( Effect.flip );
		} ) );

		expect( result._tag ).toBe( "swish/UndoNotAllowed" );
	} );

	test( "and a redo puts it back exactly", () => {
		const { result } = duel( engine => Effect.gen( function* () {
			yield* engine.place( { position: 4 } as PlaceInput, x );
			const played = yield* engine.getState();
			yield* engine.undo( x );
			yield* engine.redo( x );
			return { played, replayed: yield* engine.getState() };
		} ) );

		expect( result.replayed.view ).toEqual( result.played.view );
	} );
} );
