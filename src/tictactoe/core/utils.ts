import type { PlayerId } from "@/shared/engine/types";
import type { Board, CellValue, TicTacToeData } from "@/tictactoe/core/types";

/** All possible winning line combinations for a 3x3 tic-tac-toe board (rows, columns, diagonals). */
export const WINNING_LINES = [
	[ 0, 1, 2 ], [ 3, 4, 5 ], [ 6, 7, 8 ], // rows
	[ 0, 3, 6 ], [ 1, 4, 7 ], [ 2, 5, 8 ], // columns
	[ 0, 4, 8 ], [ 2, 4, 6 ]               // diagonals
];

/**
 * Check the board for a winning three-in-a-row.
 *
 * @param board - The current board state.
 * @returns The winning symbol ("X" or "O"), or null if no winner.
 */
export function checkWinner( board: Board ): CellValue {
	for ( const [ a, b, c ] of WINNING_LINES ) {
		if ( board[ a ] && board[ a ] === board[ b ] && board[ a ] === board[ c ] ) {
			return board[ a ];
		}
	}
	return null;
}

/**
 * Check if all cells on the board are occupied.
 *
 * @param board - The current board state.
 * @returns True if every cell is filled.
 */
export function isBoardFull( board: Board ): boolean {
	return board.every( cell => cell !== null );
}

/**
 * Get the X/O symbol assigned to a player.
 *
 * @param state - The game state containing symbol assignments.
 * @param playerId - The player to look up.
 * @returns The player's assigned symbol ("X" or "O").
 */
export function getSymbol( state: TicTacToeData, playerId: PlayerId ) {
	return Object.keys( state.symbols )
		.map( k => k as "X" | "O" )
		.find( sym => state.symbols[ sym ] === playerId )!;
}

/**
 * Find the optimal move for the bot using the minimax algorithm.
 * Evaluates all possible future game states to choose the best position.
 *
 * @param board - The current board state.
 * @param botSymbol - The bot's assigned symbol ("X" or "O").
 * @returns The board position index (0-8) for the optimal move.
 */
export function findBestMove( board: Board, botSymbol: CellValue ): number {
	const opponent: CellValue = botSymbol === "X" ? "O" : "X";

	function minimax( b: Board, isMaximizing: boolean, depth: number ): number {
		const winner = checkWinner( b );
		if ( winner === botSymbol ) return 10 - depth;
		if ( winner === opponent ) return depth - 10;
		if ( isBoardFull( b ) ) return 0;

		let best = isMaximizing ? -Infinity : Infinity;

		for ( let i = 0; i < 9; i++ ) {
			if ( b[ i ] !== null ) continue;

			b[ i ] = isMaximizing ? botSymbol : opponent;
			const score = minimax( b, !isMaximizing, depth + 1 );
			b[ i ] = null;

			best = isMaximizing ? Math.max( best, score ) : Math.min( best, score );
		}

		return best;
	}

	let bestScore = -Infinity;
	let bestPosition = -1;

	for ( let i = 0; i < 9; i++ ) {
		if ( board[ i ] !== null ) continue;

		board[ i ] = botSymbol;
		const score = minimax( board, false, 0 );
		board[ i ] = null;

		if ( score > bestScore ) {
			bestScore = score;
			bestPosition = i;
		}
	}

	return bestPosition;
}
