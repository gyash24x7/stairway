import {
	Placed,
	PlaceInput,
	SymbolAssigned,
	TicTacToeConfig,
	TicTacToeEvent,
	TicTacToePlayerView,
	TicTacToeState,
	TicTacToeTableView,
	TicTacToeView,
	WinnerDecided
} from "@/games/tictactoe/shared/schema.ts";
import { makeEngine } from "@/shared/swish/engine.ts";
import { InvalidMove } from "@/shared/swish/errors.ts";
import { PlayerId } from "@/shared/swish/schema.ts";
import { makeStandings } from "@/shared/swish/standings.ts";
import { defineView } from "@/shared/swish/views.ts";
import { apply, checkWinner, findBestMove, isBoardFull, symbolOf } from "@/games/tictactoe/server/utils.ts";

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

	view: defineView( {
		table: ( { state } ) => TicTacToeTableView.make( { ...state } ),
		player: ( { state }, id ) => TicTacToePlayerView.make( { ...state, playerId: id } )
	} ),

	resolveNextPlayer: ( { context } ) => context.players[ context.turn % context.players.length ],

	/**
	 * Tic-tac-toe is scoreless: the only result is who holds the winning line. The
	 * board (not `state.winner`) is the source of truth here, so the standings hold
	 * even for a snapshot taken before `WinnerDecided` folded in. A full board with
	 * no line leaves both seats level — a draw, which `makeStandings` renders as a
	 * shared rank 1 and no outright winner.
	 */
	resolveResults: ( { state, context } ) => {
		const winnerSymbol = checkWinner( [ ...state.board ] );
		const winner = winnerSymbol ? state.symbols[ winnerSymbol ] : undefined;
		const placing = ( id: PlayerId ) => id === winner ? 1 : 0;

		return makeStandings( {
			players: context.players,
			compare: ( a, b ) => placing( b ) - placing( a )
		} );
	},

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
		if ( snapshot.view._tag !== "tictactoe/PlayerView" ) {
			return undefined;
		}

		const position = findBestMove(
			[ ...snapshot.view.board ],
			symbolOf( snapshot.view.symbols, snapshot.view.playerId )
		);
		return { moveType: "place" as const, input: { position } };
	}
} );
