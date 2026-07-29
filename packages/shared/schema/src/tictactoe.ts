import {
	BaseGameConfig,
	GameSnapshot,
	InitializeInput,
	MovePayload,
	PlayerId
} from "@s2h/swish/schema";
import * as Schema from "effect/Schema";


// --- Primitives ---------------------------------------------------------------

export type Symbol = typeof Symbol.Type;
const Symbol = Schema.Literals( [ "X", "O" ] );

export type CellValue = typeof CellValue.Type;
export const CellValue = Schema.NullOr( Symbol );

export type Board = typeof Board.Type;
export const Board = Schema.Array( CellValue );

export type Winner = typeof Winner.Type;
export const Winner = Schema.Union( [ Schema.Literal( "draw" ), PlayerId ] );


// --- Config / State / Views ------------------------------------------------------

export type TicTacToeConfig = typeof TicTacToeConfig.Type;
export const TicTacToeConfig = BaseGameConfig;

export type TicTacToeState = typeof TicTacToeState.Type;
export const TicTacToeState = Schema.Struct( {
	board: Schema.Array( CellValue ),
	symbols: Schema.Struct( { X: PlayerId, O: PlayerId } ),
	winner: Schema.optional( Winner )
} );

export type TicTacToeView = typeof TicTacToeView.Type;
export const TicTacToeView = Schema.Struct( {
	...TicTacToeState.fields,
	playerId: Schema.optional( PlayerId )
} );

export type TicTacToeSnapshot = typeof TicTacToeSnapshot.Type;
export const TicTacToeSnapshot = GameSnapshot( TicTacToeView, TicTacToeConfig );


// --- Move Inputs ------------------------------------------------------

export type PlaceInput = typeof PlaceInput.Type;
export const PlaceInput = Schema.Struct( { position: Schema.Number } );

export type PlaceMovePayload = typeof PlaceMovePayload.Type;
export const PlaceMovePayload = MovePayload( PlaceInput );

export type TicTacToeInitializeInput = typeof TicTacToeInitializeInput.Type;
export const TicTacToeInitializeInput = InitializeInput( TicTacToeConfig );


// --- Domain Events -----------------------------------------------

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
