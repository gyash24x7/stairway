// @s2h/tictactoe/swish — Tic-Tac-Toe as an event-sourced swish game.
//
// The swish port of ./engine.ts (the old `AbstractGameEngine` DO). Same rules,
// re-expressed under event sourcing: moves/hooks EMIT domain events and a pure
// `apply` reducer folds them onto `state` (the only place state changes). The
// pure board helpers in ./utils are reused as-is.

import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import { EngineRpc } from "@s2h/swish/rpc";
import { PlayerId } from "@s2h/swish/schema";
import { defineGame } from "@s2h/swish/structure";
import * as Effect from "effect/Effect";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
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

export const tictactoe = makeEngine(
	defineGame( {
		name: "tic-tac-toe",
		stateSchema: TicTacToeState,
		configSchema: TicTacToeConfig,
		sharedViewSchema: TicTacToeSharedView,
		playerViewSchema: TicTacToePlayerView,
		eventSchema: TicTacToeEvent,
		apply,

		setup: () => Effect.succeed( {
			board: Array.from( { length: 9 }, () => null ),
			symbols: { X: PlayerId.make( "" ), O: PlayerId.make( "" ) }
		} ),

		endIf: ( { state } ) => Effect.succeed(
			checkWinner( [ ...state.board ] ) !== null || isBoardFull( [ ...state.board ] )
		),

		sharedView: ( { state } ) => Effect.succeed( state ),
		playerView: ( _data, playerId ) => Effect.succeed( { playerId } ),
		resolveNextPlayer: ( { context } ) =>
			Effect.succeed( context.players[ context.turn % context.players.length ] ),

		hooks: {
			onJoin: ( { state }, playerId ) =>
				Effect.succeed( [
					SymbolAssigned.make( {
						symbol: state.symbols.X ? "O" : "X",
						playerId
					} )
				] ),

			onEnd: ( { state } ) => {
				const board = [ ...state.board ];
				const winnerSymbol = checkWinner( board );
				if ( winnerSymbol ) {
					return Effect.succeed( [ WinnerDecided.make( { winner: state.symbols[ winnerSymbol ] } ) ] );
				}

				if ( isBoardFull( board ) ) {
					return Effect.succeed( [ WinnerDecided.make( { winner: "draw" as const } ) ] );
				}

				return Effect.succeed( [] );
			}
		},

		moves: {
			place: {
				input: PlaceInput,
				validate: ( { state }, _playerId, { position } ) => {
					if ( position < 0 || position > 8 ) {
						return new InvalidMove( { move: "place", reason: "Invalid position." } );
					}

					if ( state.board[ position ] !== null ) {
						return new InvalidMove( { move: "place", reason: "Cell is already occupied." } );
					}

					return Effect.void;
				},
				execute: ( { state }, playerId, { position } ) => Effect.succeed( [
					Placed.make( { position, symbol: symbolOf( state.symbols, playerId ) } )
				] )
			}
		},

		botMove: ( { state } ) => {
			const board = [ ...state.board ];
			const position = findBestMove( board, symbolOf( state.symbols, state.playerId ) );
			return Effect.succeed( { moveType: "place" as const, input: { position } } );
		}
	} )
);

// --- RPC surface -----------------------------------------------------------

export class TicTacToeRpcs extends RpcGroup.make(
	EngineRpc.makeInitialize( TicTacToeConfig ),
	EngineRpc.makeGetState( TicTacToeSnapshot ),
	EngineRpc.makeJoin(),
	EngineRpc.makeAddBots(),
	EngineRpc.makeStart(),
	EngineRpc.makeForMove( "place", PlaceInput ),
	EngineRpc.makeUndo( TicTacToeSnapshot ),
	EngineRpc.makeRedo( TicTacToeSnapshot )
) {
	public static layer = TicTacToeRpcs.toLayer( {
		initialize: tictactoe.initialize,
		getState: tictactoe.getState,
		join: tictactoe.join,
		addBots: tictactoe.addBots,
		start: tictactoe.start,
		undo: tictactoe.undo,
		redo: tictactoe.redo,
		place: ( { playerInfo, input } ) => tictactoe.submitMove( "place", playerInfo, input )
	} );
}
