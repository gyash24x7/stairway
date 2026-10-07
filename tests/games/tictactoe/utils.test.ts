import { assert, describe, it } from "@effect/vitest";

import type { Board, CellValue } from "@/games/tictactoe/schema";
import {
	checkWinner,
	findBestMove,
	isBoardFull,
	symbolOf,
	WINNING_LINES
} from "@/games/tictactoe/utils";
import type { PlayerId } from "@/swish/schema";


const EMPTY: Board = Array.from( { length: 9 }, () => null );

const boardOf = ( cells: string ): Board =>
	[ ...cells ].map( cell => cell === "." ? null : cell as CellValue );

const alice = "alice" as PlayerId;
const bob = "bob" as PlayerId;


describe( "tictactoe utils", () => {

	describe( "symbolOf", () => {

		it( "gives X to whoever holds it and O to everyone else", () => {
			assert.strictEqual( symbolOf( { X: alice, O: bob }, alice ), "X" );
			assert.strictEqual( symbolOf( { X: alice, O: bob }, bob ), "O" );
		} );

		it( "falls through to O when X is unclaimed", () => {
			assert.strictEqual( symbolOf( {}, alice ), "O" );
		} );
	} );

	describe( "checkWinner", () => {

		it( "finds no winner on an empty board", () => {
			assert.strictEqual( checkWinner( EMPTY ), null );
		} );

		// Every line, both symbols: the table is the rule, so the test is the table.
		for ( const line of WINNING_LINES ) {
			for ( const symbol of [ "X", "O" ] as const ) {
				it( `finds ${ symbol } on [ ${ line.join( ", " ) } ]`, () => {
					const board = [ ...EMPTY ] as Array<CellValue>;
					for ( const cell of line ) {
						board[ cell ] = symbol;
					}

					assert.strictEqual( checkWinner( board ), symbol );
				} );
			}
		}

		it( "does not call a line mixing both symbols a win", () => {
			assert.strictEqual( checkWinner( boardOf( "XXO......" ) ), null );
		} );

		it( "reads the first winning line when a board holds two", () => {
			// Not reachable in play, but the function is total and the answer is
			// row-major order rather than undefined.
			assert.strictEqual( checkWinner( boardOf( "XXXOOO..." ) ), "X" );
		} );
	} );

	describe( "isBoardFull", () => {

		it( "is false while a cell is free", () => {
			assert.isFalse( isBoardFull( EMPTY ) );
			assert.isFalse( isBoardFull( boardOf( "XOXOXOXO." ) ) );
		} );

		it( "is true once every cell is played", () => {
			assert.isTrue( isBoardFull( boardOf( "XOXOXOXOX" ) ) );
		} );
	} );

	describe( "findBestMove", () => {

		it( "takes the win when one is on offer", () => {
			assert.strictEqual( findBestMove( [ ...boardOf( "XX.OO...." ) ], "X" ), 2 );
		} );

		it( "blocks the opponent's win when it has none of its own", () => {
			assert.strictEqual( findBestMove( [ ...boardOf( "OO..X...." ) ], "X" ), 2 );
		} );

		it( "prefers its own win over blocking", () => {
			// X wins at 2; O would win at 5. Winning beats defending.
			assert.strictEqual( findBestMove( [ ...boardOf( "XX.OO...." ) ], "X" ), 2 );
		} );

		it( "returns -1 on a full board", () => {
			assert.strictEqual( findBestMove( [ ...boardOf( "XOXXOOOXX" ) ], "X" ), -1 );
		} );

		/**
		 * The real contract, and the only one worth asserting: perfect play never
		 * loses. Played out against every legal opponent reply rather than against
		 * a handful of openings, because a minimax that is subtly wrong is wrong
		 * in the lines nobody thought to write down.
		 */
		it( "never loses, against any line of play", () => {
			const worstCase = ( board: Array<CellValue>, botTurn: boolean, bot: "O" | "X" ): number => {
				const winner = checkWinner( board );
				if ( winner ) {
					return winner === bot ? 1 : -1;
				}

				if ( isBoardFull( board ) ) {
					return 0;
				}

				if ( botTurn ) {
					const position = findBestMove( [ ...board ], bot );
					board[ position ] = bot;
					const score = worstCase( board, false, bot );
					board[ position ] = null;
					return score;
				}

				const opponent = bot === "X" ? "O" : "X";
				let worst = 1;
				for ( let i = 0; i < 9; i++ ) {
					if ( board[ i ] !== null ) {
						continue;
					}

					board[ i ] = opponent;
					worst = Math.min( worst, worstCase( board, true, bot ) );
					board[ i ] = null;
				}

				return worst;
			};

			assert.isAtLeast( worstCase( [ ...EMPTY ], true, "X" ), 0, "as X, moving first" );
			assert.isAtLeast( worstCase( [ ...EMPTY ], false, "O" ), 0, "as O, moving second" );
		} );
	} );
} );
