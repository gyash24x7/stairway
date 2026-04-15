import { GameEngine } from "@/shared/engine/engine";
import { createLogger } from "@/shared/utils/logger";
import type { Board, CellValue, PlaceInput, TicTacToeData } from "@/tictactoe/core/types";

const WINNING_LINES = [
	[ 0, 1, 2 ], [ 3, 4, 5 ], [ 6, 7, 8 ], // rows
	[ 0, 3, 6 ], [ 1, 4, 7 ], [ 2, 5, 8 ], // columns
	[ 0, 4, 8 ], [ 2, 4, 6 ]               // diagonals
];

function checkWinner( board: Board ): CellValue {
	for ( const [ a, b, c ] of WINNING_LINES ) {
		if ( board[ a ] && board[ a ] === board[ b ] && board[ a ] === board[ c ] ) {
			return board[ a ];
		}
	}
	return null;
}

function isBoardFull( board: Board ): boolean {
	return board.every( cell => cell !== null );
}

const logger = createLogger( "TicTacToe:Engine" );

export const ticTacToeEngine = new GameEngine( {
	name: "tic-tac-toe",
	getNextPlayer: "round-robin",

	playerView: ( data, _config, playerId ) => ( { ...data, playerId } ),

	setup: ( _: {} ): TicTacToeData => ( { board: Array( 9 ).fill( null ) as Board, symbols: {} } ),

	hooks: {
		onJoin: ( state, _config, playerId ) => {
			state.data.symbols[ playerId ] = Object.keys( state.data.symbols ).length === 0 ? "X" : "O";
			return state.data;
		}
	},

	moves: {
		place: {
			validate: ( state, _config, _playerId, { position }: PlaceInput ) => {
				if ( position < 0 || position > 8 ) {
					logger.debug( "Invalid placement!" );
					throw new Error( "Invalid position." );
				}

				if ( state.data.board[ position ] !== null ) {
					logger.debug( "Cell already occupied!" );
					throw new Error( "Cell is already occupied." );
				}
			},
			execute: ( state, _config, playerId, { position }: PlaceInput ) => {
				state.data.board[ position ] = state.data.symbols[ playerId ];
				return state.data;
			}
		}
	},

	endIf: ( state, _config ) => {
		const winner = checkWinner( state.data.board );

		if ( winner ) {
			const winnerId = Object.entries( state.data.symbols ).find( ( [ _, sym ] ) => sym === winner )![ 0 ];
			return { victory: true, winner: winnerId };
		}

		if ( isBoardFull( state.data.board ) ) {
			return { victory: false };
		}

		return undefined;
	}
} );
