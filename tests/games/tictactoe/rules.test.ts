import { assert, describe, it } from "@effect/vitest";

import { atPosition } from "@tests/harness/position";

import type { Board, CellValue } from "@/games/tictactoe/schema";
import { TicTacToeConfig } from "@/games/tictactoe/schema";
import { TicTacToeStructure } from "@/games/tictactoe/server/engine";
import type { PlayerId } from "@/swish/schema";
import { PlayerAudience, TableAudience } from "@/swish/schema";


const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;

const config = TicTacToeConfig.make( {
	playerCount: 2,
	autoStart: true,
	botDelayMillis: 5_000,
	moveTimeoutMillis: 60_000
} );

const boardOf = ( cells: string ): Board =>
	[ ...cells ].map( cell => cell === "." ? null : cell as CellValue );

const at = ( cells: string, current: PlayerId = alice ) => atPosition( TicTacToeStructure, {
	state: { board: boardOf( cells ), symbols: { X: alice, O: bob } },
	config,
	context: { players: [ alice, bob ], currentPlayer: current, turn: 0 }
} );


describe( "tictactoe rules", () => {

	describe( "onJoin", () => {

		it( "gives X to the first seat", () => {
			const game = atPosition( TicTacToeStructure, {
				state: { board: boardOf( "........." ), symbols: {} },
				config
			} );

			const events = game.onJoin( alice );
			assert.deepStrictEqual(
				events,
				[ { _tag: "tictactoe/ev/SymbolAssigned", symbol: "X", playerId: alice } ]
			);
		} );

		it( "gives O to the second, once X is taken", () => {
			const game = atPosition( TicTacToeStructure, {
				state: { board: boardOf( "........." ), symbols: {} },
				config
			} );

			game.apply( ...game.onJoin( alice ) );
			const events = game.onJoin( bob );

			assert.deepStrictEqual(
				events,
				[ { _tag: "tictactoe/ev/SymbolAssigned", symbol: "O", playerId: bob } ]
			);
			game.apply( ...events );
			assert.deepStrictEqual( game.state.symbols, { X: alice, O: bob } );
		} );
	} );

	describe( "place", () => {

		it( "allows a free cell", () => {
			assert.isUndefined( at( "........." ).validate( "place", alice, { position: 4 } ) );
		} );

		it( "refuses an occupied cell", () => {
			const invalid = at( "....X...." ).validate( "place", alice, { position: 4 } );
			assert.strictEqual( invalid?._tag, "swish/InvalidMove" );
			assert.strictEqual( invalid?.move, "place" );
			assert.strictEqual( invalid?.reason, "Cell is already occupied." );
		} );

		it( "refuses a cell the other player took", () => {
			assert.isDefined( at( "....O...." ).validate( "place", alice, { position: 4 } ) );
		} );

		it( "records the mark, not the player", () => {
			const game = at( "........." );
			const events = game.execute( "place", alice, { position: 4 } );
			assert.deepStrictEqual(
				events,
				[ { _tag: "tictactoe/ev/Placed", position: 4, symbol: "X" } ]
			);
		} );

		it( "writes O when the second seat plays", () => {
			const game = at( "....X....", bob );
			game.play( "place", bob, { position: 0 } );
			assert.strictEqual( game.state.board[ 0 ], "O" );
		} );

		it( "leaves every other cell alone", () => {
			const game = at( "X...O...." );
			game.play( "place", alice, { position: 8 } );
			assert.deepStrictEqual( [ ...game.state.board ], [ ...boardOf( "X...O...X" ) ] );
		} );

		it( "is a turn-ending move", () => {
			assert.isTrue( at( "........." ).endsTurn( "place", alice, { position: 0 } ) );
		} );
	} );

	describe( "endIf", () => {

		it( "keeps going while the board is open and nobody has a line", () => {
			assert.isFalse( at( "XO......." ).endIf() );
		} );

		it( "ends on a win", () => {
			assert.isTrue( at( "XXXOO...." ).endIf() );
		} );

		it( "ends on a full board with no line", () => {
			assert.isTrue( at( "XXOOOXXOX" ).endIf() );
		} );
	} );

	describe( "resolveResults", () => {

		it( "ranks the winner first and names them", () => {
			const results = at( "XXXOO...." ).results();
			assert.strictEqual( results?.winner, alice );
			assert.deepStrictEqual( [ ...results!.ranking ], [
				{ _tag: "swish/PlayerStanding", playerId: alice, rank: 1 },
				{ _tag: "swish/PlayerStanding", playerId: bob, rank: 2 }
			] );
		} );

		it( "ranks the second seat first when it is the one with the line", () => {
			const results = at( "OOOXX...." ).results();
			assert.strictEqual( results?.winner, bob );
			assert.strictEqual( results?.ranking.find( r => r.playerId === bob )?.rank, 1 );
		} );

		it( "gives a drawn board no winner and everyone rank 1", () => {
			const results = at( "XXOOOXXOX" ).results();
			assert.isUndefined( results?.winner );
			assert.deepStrictEqual( results?.ranking.map( r => r.rank ), [ 1, 1 ] );
		} );
	} );

	describe( "view", () => {

		it( "hides nothing — the table sees the whole board", () => {
			const game = at( "X...O...." );
			const table = game.view( TableAudience.make( {} ) );

			assert.deepStrictEqual( [ ...table.board ], [ ...boardOf( "X...O...." ) ] );
			assert.deepStrictEqual( table.symbols, { X: alice, O: bob } );
		} );

		it( "differs between audiences only by playerId", () => {
			const game = at( "X...O...." );
			const table = game.view( TableAudience.make( {} ) );
			const mine = game.view( PlayerAudience.make( { playerId: alice } ) );

			assert.isUndefined( table.playerId );
			assert.strictEqual( mine.playerId, alice );
			assert.deepStrictEqual( { ...table, playerId: alice }, { ...mine } );
		} );
	} );

	describe( "botMove", () => {

		it( "plays for the seat the view was built for", () => {
			const game = at( "XX.......", bob );
			const choice = game.bot( PlayerAudience.make( { playerId: bob } ) );

			// Bob is O, and X threatens at 2 with nothing of its own to chase.
			assert.strictEqual( choice?.moveType, "place" );
			assert.deepStrictEqual( choice?.input, { position: 2 } );
		} );

		it( "takes its own win ahead of a block", () => {
			const game = at( "OO.XX....", bob );
			const choice = game.bot( PlayerAudience.make( { playerId: bob } ) );
			assert.deepStrictEqual( choice?.input, { position: 2 } );
		} );
	} );
} );
