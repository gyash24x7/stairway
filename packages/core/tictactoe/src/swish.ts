// @s2h/tictactoe/swish — Tic-Tac-Toe as an event-sourced swish game.
//
// The swish port of ./engine.ts (the old `AbstractGameEngine` DO). Same rules,
// re-expressed under event sourcing: moves/hooks EMIT domain events and a pure
// `apply` reducer folds them onto `state` (the only place state changes). The
// pure board helpers in ./utils are reused as-is.

import { Effect, Match, Schema } from "effect";
import { RpcGroup } from "effect/unstable/rpc";
import { makeEngine } from "@s2h/swish/engine";
import { InvalidMove } from "@s2h/swish/errors";
import { EngineRpc } from "@s2h/swish/rpc";
import { PlayerId } from "@s2h/swish/schema";
import { defineGame } from "@s2h/swish/structure";
import type { Board } from "./types";
import { checkWinner, findBestMove, isBoardFull } from "./utils";

// --- Schemas ---------------------------------------------------------------

const Symbol = Schema.Literals( [ "X", "O" ] );
const CellValue = Schema.NullOr( Symbol );
const Winner = Schema.Union( [ Schema.Literal( "draw" ), PlayerId ] );

export const TicTacToeConfig = Schema.Struct( {
	playerCount: Schema.Number,
	autoStart: Schema.optional( Schema.Boolean )
} );

export const TicTacToeState = Schema.Struct( {
	board: Schema.Array( CellValue ),
	symbols: Schema.Struct( { X: PlayerId, O: PlayerId } ),
	winner: Schema.optional( Winner )
} );

export const TicTacToeShared = TicTacToeState;
export const TicTacToePlayer = Schema.Struct( { playerId: PlayerId } );
export const PlaceInput = Schema.Struct( { position: Schema.Number } );

type TicTacToeState = typeof TicTacToeState.Type;
type SymbolValue = typeof Symbol.Type;

// --- Domain events + reducer -----------------------------------------------

const SymbolAssigned = Schema.TaggedStruct( "tictactoe/SymbolAssigned", {
	symbol: Symbol,
	playerId: PlayerId
} );
const Placed = Schema.TaggedStruct( "tictactoe/Placed", { position: Schema.Number, symbol: Symbol } );
const WinnerDecided = Schema.TaggedStruct( "tictactoe/WinnerDecided", { winner: Winner } );

const TicTacToeEvent = Schema.Union( [ SymbolAssigned, Placed, WinnerDecided ] );
type TicTacToeEvent = typeof TicTacToeEvent.Type;

/** Pure reducer — the ONLY place `state` changes. */
const apply = ( state: TicTacToeState, event: TicTacToeEvent ): TicTacToeState =>
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
const symbolOf = ( symbols: TicTacToeState[ "symbols" ], playerId: PlayerId ): SymbolValue =>
	symbols.X === playerId ? "X" : "O";

// --- Engine ----------------------------------------------------------------

export const ticTacToe = makeEngine(
	defineGame( {
		name: "tic-tac-toe",
		stateSchema: TicTacToeState,
		configSchema: TicTacToeConfig,
		sharedViewSchema: TicTacToeShared,
		playerViewSchema: TicTacToePlayer,
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
		// Round-robin: after each move `TurnAdvanced` bumps `turn`, so this picks
		// the next player in join order.
		resolveNextPlayer: ( { context } ) =>
			Effect.succeed( context.players[ context.turn % context.players.length ] ),

		hooks: {
			// Runs before `PlayerJoined`: the first joiner takes X, the second O.
			onJoin: ( { state }, playerId ) =>
				Effect.succeed( [ SymbolAssigned.make( { symbol: state.symbols.X ? "O" : "X", playerId } ) ] ),
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
						return Effect.fail( new InvalidMove( { move: "place", reason: "Invalid position." } ) );
					}
					if ( state.board[ position ] !== null ) {
						return Effect.fail( new InvalidMove( { move: "place", reason: "Cell is already occupied." } ) );
					}
					return Effect.void;
				},
				execute: ( { state }, playerId, { position } ) =>
					Effect.succeed( [ Placed.make( { position, symbol: symbolOf( state.symbols, playerId ) } ) ] )
			}
		},

		botMove: ( { state } ) => {
			const board = [ ...state.board ] as Board;
			const position = findBestMove( board, symbolOf( state.symbols, state.playerId ) );
			return Effect.succeed( { moveType: "place" as const, input: { position } } );
		}
	} )
);

// --- RPC surface -----------------------------------------------------------

export class TicTacToeRpcs extends RpcGroup.make(
	EngineRpc.makeInitialize( TicTacToeConfig ),
	EngineRpc.makeGetState( TicTacToeShared, TicTacToePlayer ),
	EngineRpc.makeJoin(),
	EngineRpc.makeAddBots(),
	EngineRpc.makeStart(),
	EngineRpc.makeForMove( "place", PlaceInput ),
	EngineRpc.makeUndo( TicTacToeShared, TicTacToePlayer ),
	EngineRpc.makeRedo( TicTacToeShared, TicTacToePlayer )
) {
	public static layer = TicTacToeRpcs.toLayer( {
		initialize: ticTacToe.initialize,
		getState: ticTacToe.getState,
		join: ticTacToe.join,
		addBots: ticTacToe.addBots,
		start: ticTacToe.start,
		undo: ticTacToe.undo,
		redo: ticTacToe.redo,
		place: ( { playerInfo, input } ) => ticTacToe.submitMove( "place", playerInfo, input )
	} );
}
