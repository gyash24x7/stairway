import { BaseGameConfig, type BaseGameData, GameSnapshot, PlayerId } from "@s2h/swish/schema";
import * as Schema from "effect/Schema";

// --- Schemas ---------------------------------------------------------------

export type Symbol = typeof Symbol.Type;
const Symbol = Schema.Literals( [ "X", "O" ] );

export type CellValue = typeof CellValue.Type;
export const CellValue = Schema.NullOr( Symbol );

export type Board = typeof Board.Type;
export const Board = Schema.Array( CellValue );

export type Winner = typeof Winner.Type;
const Winner = Schema.Union( [ Schema.Literal( "draw" ), PlayerId ] );

export type TicTacToeConfig = typeof TicTacToeConfig.Type;
export const TicTacToeConfig = BaseGameConfig;

export type TicTacToeState = typeof TicTacToeState.Type;
export const TicTacToeState = Schema.Struct( {
	board: Schema.Array( CellValue ),
	symbols: Schema.Struct( { X: PlayerId, O: PlayerId } ),
	winner: Schema.optional( Winner )
} );

export type TicTacToeSharedView = typeof TicTacToeSharedView.Type;
export const TicTacToeSharedView = TicTacToeState;

export type TicTacToePlayerView = typeof TicTacToePlayerView.Type;
export const TicTacToePlayerView = Schema.Struct( { playerId: PlayerId } );

export type TicTacToeSnapshot = typeof TicTacToeSnapshot.Type;
export const TicTacToeSnapshot = GameSnapshot( TicTacToeSharedView, TicTacToePlayerView, TicTacToeConfig );

export type PlaceInput = typeof PlaceInput.Type;
export const PlaceInput = Schema.Struct( { position: Schema.Number } );

export type TicTacToeData = BaseGameData & {
	shared: TicTacToeSharedView;
	player: TicTacToePlayerView;
	config: TicTacToeConfig;
}

// --- Domain events -----------------------------------------------

export const SymbolAssigned = Schema.TaggedStruct( "tictactoe/SymbolAssigned", {
	symbol: Symbol,
	playerId: PlayerId
} );

export const Placed = Schema.TaggedStruct(
	"tictactoe/Placed",
	{ position: Schema.Number, symbol: Symbol }
);

export type WinnerDecided = typeof WinnerDecided.Type;
export const WinnerDecided = Schema.TaggedStruct( "tictactoe/WinnerDecided", { winner: Winner } );

export type TicTacToeEvent = typeof TicTacToeEvent.Type;
export const TicTacToeEvent = Schema.Union( [ SymbolAssigned, Placed, WinnerDecided ] );

