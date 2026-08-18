import { describe, expect, test } from "bun:test";

import {
	checkWinner,
	findBestMove,
	isBoardFull,
	symbolOf,
	WINNING_LINES
} from "@/games/tictactoe/server/utils.ts";
import { PlayerId } from "@/swish/shared/schema.ts";

import type { Board, CellValue } from "@/games/tictactoe/shared/schema.ts";

const player = ( id: string ) => PlayerId.make( id );

const [ x, o ] = [ player( "x" ), player( "o" ) ];

/**
 * Builds a board from a nine-character sketch, `.` for a free cell — so a test
 * reads as the grid it is about.
 *
 * @param sketch - Nine characters, row-major.
 * @returns The board.
 */
const boardOf = ( sketch: string ): Board =>
	[ ...sketch.replaceAll( /\s/g, "" ) ].map( cell =>
		cell === "." ? null : cell as CellValue
	);

const EMPTY = boardOf( "........." );


describe( "the winning lines", () => {
	test( "are the three rows, three columns and two diagonals", () => {
		expect( WINNING_LINES ).toHaveLength( 8 );
		expect( new Set( WINNING_LINES.map( line => line.join( "" ) ) ).size ).toBe( 8 );
	} );

	test( "every one of them is a line the checker actually reads", () => {
		for ( const line of WINNING_LINES ) {
			const board: Array<CellValue> = Array.from( { length: 9 }, () => null );
			for ( const cell of line ) {
				board[ cell ] = "X";
			}

			expect( checkWinner( board ) ).toBe( "X" );
		}
	} );
} );


describe( "checkWinner", () => {
	test( "finds nothing on an empty board", () => {
		expect( checkWinner( EMPTY ) ).toBeNull();
	} );

	test( "finds a completed row", () => {
		expect( checkWinner( boardOf( "XXX OO. ..." ) ) ).toBe( "X" );
	} );

	test( "finds a completed column", () => {
		expect( checkWinner( boardOf( "O.X O.X O.." ) ) ).toBe( "O" );
	} );

	test( "finds both diagonals", () => {
		expect( checkWinner( boardOf( "X.O .X. O.X" ) ) ).toBe( "X" );
		expect( checkWinner( boardOf( "..O .O. O.." ) ) ).toBe( "O" );
	} );

	test( "finds nothing on a full board nobody won", () => {
		const drawn = boardOf( "XXO OOX XOX" );

		expect( checkWinner( drawn ) ).toBeNull();
		expect( isBoardFull( drawn ) ).toBe( true );
	} );

	test( "is not fooled by three of a kind that do not line up", () => {
		expect( checkWinner( boardOf( "X.X .O. X.." ) ) ).toBeNull();
	} );
} );


describe( "isBoardFull", () => {
	test( "an empty board is not", () => {
		expect( isBoardFull( EMPTY ) ).toBe( false );
	} );

	test( "one free cell is enough to keep it open", () => {
		expect( isBoardFull( boardOf( "XXO OOX XO." ) ) ).toBe( false );
	} );

	test( "a board with no free cell is", () => {
		expect( isBoardFull( boardOf( "XXO OOX XOX" ) ) ).toBe( true );
	} );
} );


describe( "symbolOf", () => {
	test( "gives X to the seat holding it", () => {
		expect( symbolOf( { X: x, O: o }, x ) ).toBe( "X" );
	} );

	test( "gives O to everyone else", () => {
		expect( symbolOf( { X: x, O: o }, o ) ).toBe( "O" );
	} );

	test( "reads O before the marks are handed out, since X is what it checks", () => {
		expect( symbolOf( {}, x ) ).toBe( "O" );
	} );
} );


describe( "findBestMove", () => {
	test( "takes the win that is one move away", () => {
		expect( findBestMove( [ ...boardOf( "XX. OO. ..." ) ], "X" ) ).toBe( 2 );
	} );

	test( "blocks the opponent's win when it has none of its own", () => {
		expect( findBestMove( [ ...boardOf( "OO. X.. X.." ) ], "X" ) ).toBe( 2 );
	} );

	test( "prefers its own win over blocking", () => {
		// X can finish the top row; O could finish the left column next turn.
		expect( findBestMove( [ ...boardOf( "XX. O.. O.." ) ], "X" ) ).toBe( 2 );
	} );

	test( "takes the shortest win when several are available", () => {
		// Winning now scores higher than winning a move later.
		const board = [ ...boardOf( "XX. ..X O.O" ) ];

		expect( findBestMove( board, "X" ) ).toBe( 2 );
	} );

	test( "leaves the board exactly as it found it", () => {
		const board = [ ...boardOf( "XX. OO. ..." ) ];
		const before = [ ...board ];

		findBestMove( board, "X" );

		expect( board ).toEqual( before );
	} );

	test( "answers with -1 on a board with nowhere to play", () => {
		expect( findBestMove( [ ...boardOf( "XXO OOX XOX" ) ], "X" ) ).toBe( -1 );
	} );

	test( "never loses to any opening reply", () => {
		// Perfect play against perfect play is a draw, so the search must never
		// hand the game away whatever the opponent does first.
		for ( let opening = 0; opening < 9; opening++ ) {
			const board: Array<CellValue> = Array.from( { length: 9 }, () => null );
			board[ opening ] = "O";

			let turn: CellValue = "X";
			while ( checkWinner( board ) === null && !isBoardFull( board ) ) {
				board[ findBestMove( board, turn ) ] = turn;
				turn = turn === "X" ? "O" : "X";
			}

			expect( checkWinner( board ) ).not.toBe( "O" );
		}
	} );
} );
