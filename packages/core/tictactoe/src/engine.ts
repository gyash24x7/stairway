// @s2h/tictactoe/swish — Tic-Tac-Toe as an event-sourced swish game.
//
// The swish port of ./engine.ts (the old `AbstractGameEngine` DO). Same rules,
// re-expressed under event sourcing: moves/hooks EMIT domain events and a pure
// `apply` reducer folds them onto `state` (the only place state changes). The
// pure board helpers in ./utils are reused as-is.

import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import { EngineRpcs, MoveRpc } from "@s2h/swish/rpc";
import { PlayerId } from "@s2h/swish/schema";
import {
	Placed,
	PlaceInput,
	SymbolAssigned,
	TicTacToeConfig,
	TicTacToeEvent,
	TicTacToePlayerView,
	TicTacToeSharedView,
	TicTacToeSnapshot,
	TicTacToeState,
	WinnerDecided
} from "./schema";
import { apply, checkWinner, findBestMove, isBoardFull, symbolOf } from "./utils";

// --- Engine ----------------------------------------------------------------

export const tictactoe = makeEngine( {
	name: "tic-tac-toe",
	schemas: {
		state: TicTacToeState,
		config: TicTacToeConfig,
		events: TicTacToeEvent,
		moves: {
			place: PlaceInput
		},
		views: {
			shared: TicTacToeSharedView,
			player: TicTacToePlayerView
		}
	},

	setup: () => ( {
		board: Array.from( { length: 9 }, () => null ),
		symbols: { X: PlayerId.make( "" ), O: PlayerId.make( "" ) }
	} ),

	apply,

	endIf: ( { state } ) =>
		checkWinner( [ ...state.board ] ) !== null || isBoardFull( [ ...state.board ] ),

	sharedView: ( { state } ) => state,
	playerView: ( _data, playerId ) => ( { playerId } ),

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
			[ ...snapshot.shared.board ],
			symbolOf( snapshot.shared.symbols, snapshot.player.playerId )
		);
		return { moveType: "place" as const, input: { position } };
	}
} );

// --- RPC surface -----------------------------------------------------------

export class TicTacToeRpcs extends EngineRpcs( TicTacToeConfig, TicTacToeSnapshot, [
	MoveRpc( "place", PlaceInput )
] ) {

	public static layer = TicTacToeRpcs.toLayer( tictactoe );
}
