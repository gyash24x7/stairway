import type { PlayerId } from "@s2h/schema/swish";
import type { Board, CellValue, TicTacToeEvent, TicTacToeState } from "@s2h/schema/tictactoe";
import * as Match from "effect/Match";
import * as Types from "effect/Types";

/** Pure reducer — the ONLY place `state` changes. */
export const apply = ( state: TicTacToeState, event: TicTacToeEvent ) =>
	Match.value( event ).pipe(
		Match.tag( "tictactoe/SymbolAssigned", ( e ) =>
			( { ...state, symbols: { ...state.symbols, [ e.symbol ]: e.playerId } } ) ),
		Match.tag( "tictactoe/Placed", ( e ) => {
			const board = [ ...state.board ];
			board[ e.position ] = e.symbol;
			return { ...state, board };
		} ),
		Match.tag( "tictactoe/WinnerDecided", ( e ) => ( { ...state, winner: e.winner } ) ),
		Match.exhaustive
	);

/** The X/O symbol assigned to a player. */
export const symbolOf = ( symbols: TicTacToeState[ "symbols" ], playerId: PlayerId ) =>
	symbols.X === playerId ? "X" : "O";

/** All possible winning line combinations for a 3x3 tic-tac-toe board. */
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
export function checkWinner( board: Board ) {
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
export function isBoardFull( board: Board ) {
	return board.every( cell => cell !== null );
}

/**
 * Find the optimal move for the bot using the minimax algorithm.
 * Evaluates all possible future game states to choose the best position.
 *
 * @param board - The current board state.
 * @param botSymbol - The bot's assigned symbol ("X" or "O").
 * @returns The board position index (0-8) for the optimal move.
 */
export function findBestMove(
	board: Types.Mutable<Board>,
	botSymbol: CellValue
) {
	const opponent = botSymbol === "X" ? "O" : "X";

	function minimax( b: Types.Mutable<Board>, isMaximizing: boolean, depth: number ) {
		const winner = checkWinner( b );
		if ( winner === botSymbol ) {
			return 10 - depth;
		}

		if ( winner === opponent ) {
			return depth - 10;
		}

		if ( isBoardFull( b ) ) {
			return 0;
		}

		let best = isMaximizing ? -Infinity : Infinity;

		for ( let i = 0; i < 9; i++ ) {
			if ( b[ i ] !== null ) {
				continue;
			}

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
		if ( board[ i ] !== null ) {
			continue;
		}

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

/** Registry slug for this game (also the DO name prefix). */
export const GAME_NAME = "tic-tac-toe";
