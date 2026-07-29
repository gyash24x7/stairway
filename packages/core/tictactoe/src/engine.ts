import {
	Placed,
	PlaceInput,
	SymbolAssigned,
	TicTacToeConfig,
	TicTacToeEvent,
	TicTacToeState,
	TicTacToeView,
	WinnerDecided
} from "@s2h/schema/tictactoe";
import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import { PlayerId } from "@s2h/swish/schema";
import { apply, checkWinner, findBestMove, isBoardFull, symbolOf } from "./utils";

// --- Engine ----------------------------------------------------------------

export const tictactoe = makeEngine( {
	name: "tic-tac-toe",
	schemas: {
		state: TicTacToeState,
		config: TicTacToeConfig,
		events: TicTacToeEvent,
		view: TicTacToeView,
		moves: {
			place: PlaceInput
		}
	},

	setup: () => ( {
		board: Array.from( { length: 9 }, () => null ),
		symbols: { X: PlayerId.make( "" ), O: PlayerId.make( "" ) }
	} ),

	apply,

	endIf: ( { state } ) => checkWinner( state.board ) !== null || isBoardFull( state.board ),

	view: ( { state }, audience ): TicTacToeView =>
		audience._tag === "swish/Table" ? state : { ...state, playerId: audience.id },

	resolveNextPlayer: ( { context } ) => context.players[ context.turn % context.players.length ],

	hooks: {
		onJoin: ( { state }, playerId ) => [
			SymbolAssigned.make( {
				symbol: state.symbols.X ? "O" : "X",
				playerId
			} )
		],

		onEnd: ( { state } ) => {
			const board = [ ...state.board ];
			const winnerSymbol = checkWinner( board );
			if ( winnerSymbol ) {
				return [ WinnerDecided.make( { winner: state.symbols[ winnerSymbol ] } ) ];
			}

			if ( isBoardFull( board ) ) {
				return [ WinnerDecided.make( { winner: "draw" as const } ) ];
			}

			return [];
		}
	},

	moves: {
		place: {
			validate: ( { state }, _playerId, { position } ) => {
				if ( position < 0 || position > 8 ) {
					return new InvalidMove( { move: "place", reason: "Invalid position." } );
				}

				if ( state.board[ position ] !== null ) {
					return new InvalidMove( { move: "place", reason: "Cell is already occupied." } );
				}

				return;
			},

			execute: ( { state }, playerId, { position } ) => [
				Placed.make( { position, symbol: symbolOf( state.symbols, playerId ) } )
			]
		}
	},

	botMove: ( snapshot ) => {
		const position = findBestMove(
			[ ...snapshot.view.board ],
			symbolOf( snapshot.view.symbols, snapshot.view.playerId! )
		);
		return { moveType: "place" as const, input: { position } };
	}
} );
