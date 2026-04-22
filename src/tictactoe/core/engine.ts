import { AbstractGameEngine } from "@/shared/engine/engine";
import type { BaseGameConfig, GameStructure } from "@/shared/engine/types";
import { roundRobin } from "@/shared/engine/utils";
import type { Board, PlaceInput, TicTacToeData, TicTacToeMoves, TicTacToePlayerView } from "@/tictactoe/core/types";
import { checkWinner, findBestMove, getSymbol, isBoardFull } from "@/tictactoe/core/utils";

/**
 * Durable Object game engine for Tic-Tac-Toe, a two-player game.
 * Uses a flat (non-phased) game structure with round-robin turns and minimax bot support.
 */
export class TicTacToeEngine extends AbstractGameEngine<TicTacToeData, TicTacToeMoves, BaseGameConfig, TicTacToePlayerView> {

	public static readonly NAME = "tic-tac-toe";

	protected readonly structure: GameStructure<TicTacToeData, TicTacToeMoves, BaseGameConfig, TicTacToePlayerView> = {
		name: TicTacToeEngine.NAME,
		resolveNextPlayer: roundRobin,

		playerView: ( { state }, playerId ) => ( { ...state, playerId } ),

		setup: ( _: {} ): TicTacToeData => ( {
			board: Array( 9 ).fill( null ) as Board,
			symbols: { X: "", O: "" }
		} ),

		hooks: {
			onJoin: ( { state, context }, playerId ) => {
				const symbol = context.players.length === 1 ? "X" : "O";
				state.symbols[ symbol ] = playerId;
				return state;
			},

			onEnd: ( { state } ) => {
				const winner = checkWinner( state.board );

				if ( winner ) {
					state.winner = state.symbols[ winner ];
					return state;
				}

				if ( isBoardFull( state.board ) ) {
					state.winner = "draw";
					return state;
				}

				return state;
			}
		},

		moves: {
			place: {
				validate: ( { state }, _playerId, { position }: PlaceInput ) => {
					if ( position < 0 || position > 8 ) {
						throw new Error( "Invalid position." );
					}

					if ( state.board[ position ] !== null ) {
						throw new Error( "Cell is already occupied." );
					}
				},
				execute: ( { state }, playerId, { position }: PlaceInput ) => {
					state.board[ position ] = getSymbol( state, playerId );
					return state;
				}
			}
		},

		endIf: ( { state } ) => !!checkWinner( state.board ) || isBoardFull( state.board ),

		botMove: ( { state } ) => {
			const botSymbol = getSymbol( state, state.playerId );
			const board = [ ...state.board ];
			const position = findBestMove( board, botSymbol );
			return { moveType: "place", input: { gameId: "", position } };
		}
	};
}
