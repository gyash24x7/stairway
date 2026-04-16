import type { PlayerId } from "@/shared/engine/types";
import type { Board, CellValue, TicTacToeData } from "@/tictactoe/core/types";

export const WINNING_LINES = [
	[ 0, 1, 2 ], [ 3, 4, 5 ], [ 6, 7, 8 ], // rows
	[ 0, 3, 6 ], [ 1, 4, 7 ], [ 2, 5, 8 ], // columns
	[ 0, 4, 8 ], [ 2, 4, 6 ]               // diagonals
];

export function checkWinner( board: Board ): CellValue {
	for ( const [ a, b, c ] of WINNING_LINES ) {
		if ( board[ a ] && board[ a ] === board[ b ] && board[ a ] === board[ c ] ) {
			return board[ a ];
		}
	}
	return null;
}

export function isBoardFull( board: Board ): boolean {
	return board.every( cell => cell !== null );
}

export function getSymbol( state: TicTacToeData, playerId: PlayerId ) {
	return Object.keys( state.symbols )
		.map( k => k as "X" | "O" )
		.find( sym => state.symbols[ sym ] === playerId )!;
}