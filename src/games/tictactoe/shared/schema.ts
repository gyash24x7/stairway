import * as Schema from "effect/Schema";

import {
	BaseGameConfig,
	GameSnapshot,
	InitializeInput,
	PlayerId
} from "@/shared/swish/schema.ts";


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

/**
 * Tic-tac-toe is always exactly two seats. The count is fixed here rather than
 * taken from the client: `onJoin` assigns X to the first joiner and O to every
 * later one, so a third seat would overwrite O and leave two players sharing a
 * mark.
 */
export const TICTACTOE_PLAYER_COUNT = 2;

export type TicTacToeConfig = typeof TicTacToeConfig.Type;
export const TicTacToeConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	playerCount: Schema.Literal( TICTACTOE_PLAYER_COUNT )
} );

/**
 * The `POST /create` payload. Tic-tac-toe has nothing to configure — the seat
 * count and `autoStart` are server-side constants — so the body is empty.
 */
export type TicTacToeCreateInput = typeof TicTacToeCreateInput.Type;
export const TicTacToeCreateInput = Schema.Struct( {} );

export type TicTacToeState = typeof TicTacToeState.Type;
export const TicTacToeState = Schema.Struct( {
	board: Schema.Array( CellValue ),
	symbols: Schema.Struct( { X: PlayerId, O: PlayerId } ),
	winner: Schema.optional( Winner )
} );

// A player's view adds its own (required) id; the table view is the board only.
// `TicTacToeView` is the discriminated union — clients narrow once on `_tag`.
export type TicTacToePlayerView = typeof TicTacToePlayerView.Type;
export const TicTacToePlayerView = Schema.TaggedStruct( "tictactoe/PlayerView", {
	...TicTacToeState.fields,
	playerId: PlayerId
} );

export type TicTacToeTableView = typeof TicTacToeTableView.Type;
export const TicTacToeTableView = Schema.TaggedStruct( "tictactoe/TableView", {
	...TicTacToeState.fields
} );

export type TicTacToeView = typeof TicTacToeView.Type;
export const TicTacToeView = Schema.Union( [ TicTacToePlayerView, TicTacToeTableView ] );

export type TicTacToeSnapshot = typeof TicTacToeSnapshot.Type;
export const TicTacToeSnapshot = GameSnapshot( TicTacToeView, TicTacToeConfig );


// --- Move Inputs ------------------------------------------------------

export type PlaceInput = typeof PlaceInput.Type;
export const PlaceInput = Schema.Struct( { position: Schema.Number } );

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
