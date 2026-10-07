import * as Schema from "effect/Schema";

import type { HintOf } from "@/swish/schema";
import { BaseGameConfig, InitializeInput, PlayerId } from "@/swish/schema";


// --- Enumerations ----------------------------------------------------------

/**
 * The two marks a seat plays under:
 * - X: The first seat to join, and the seat that opens the game
 * - O: The second seat to join
 *
 * The mark is what a move is recorded as, so the board stays readable without
 * the roster: a replay knows which seat played a cell from `symbols` alone.
 */
export type Symbol = typeof Symbol.Type;
const Symbol = Schema.Literals( [ "X", "O" ] );


// --- Board Primitives ------------------------------------------------------

/**
 * How many cells a board holds. Fixed at nine: the winning lines and the bot's
 * search are both written against a 3x3 grid.
 */
export const TICTACTOE_BOARD_SIZE = 9;

/**
 * What one cell holds: the mark played there, or `null` while it is free.
 * Empty is modelled as a value rather than a hole so every index is populated
 * and a client can lay the grid out from the array alone.
 */
export type CellValue = typeof CellValue.Type;
export const CellValue = Schema.NullOr( Symbol );

/**
 * The grid, held flat and indexed row-major — `0..2` is the top row, `3..5` the
 * middle, `6..8` the bottom. Always `TICTACTOE_BOARD_SIZE` long, from `setup`
 * onwards, since a move overwrites a cell rather than appending one.
 */
export type Board = typeof Board.Type;
export const Board = Schema.Array( CellValue );

/**
 * A cell index, bounded to the board.
 *
 * The bound lives here rather than in the move's `validate` because a move's
 * input is the one thing the engine decodes on its way in: a fractional or
 * out-of-range index fails at that boundary, instead of reaching the board and
 * being refused as an occupied cell — which is what a miss on an index no cell
 * owns would otherwise look like.
 */
export type Position = typeof Position.Type;
export const Position = Schema.Int.check(
	Schema.isGreaterThanOrEqualTo( 0 ),
	Schema.isLessThan( TICTACTOE_BOARD_SIZE )
);


// --- Config / State / Views ------------------------------------------------

/**
 * How many seats a table has. Exactly two, and fixed here rather than taken from
 * the client: `onJoin` gives X to the first joiner and O to every later one, so a
 * third seat would overwrite O and leave two players sharing a mark.
 */
export const TICTACTOE_PLAYER_COUNT = 2;

/**
 * How long a seat may hold its turn. An expired clock hands the seat to `botMove`
 * and leaves it there until its player takes it back, so a player who walks away
 * is played for rather than stalling the table for the other seat.
 */
export const TICTACTOE_MOVE_TIMEOUT_MILLIS = 60_000;

/**
 * How long a machine-played seat waits before it answers. Short here because the
 * board is read at a glance and a longer pause reads as the game having hung —
 * but not instant, which reads as the move having been made for you.
 */
export const TICTACTOE_BOT_DELAY_MILLIS = 5_000;

/**
 * What a table was created with. Extends `BaseGameConfig`
 * - playerCount: Always `TICTACTOE_PLAYER_COUNT`, so a table is never anything
 * 			but a duel
 */
export type TicTacToeConfig = typeof TicTacToeConfig.Type;
export const TicTacToeConfig = Schema.Struct( {
	...BaseGameConfig.fields,
	playerCount: Schema.Literal( TICTACTOE_PLAYER_COUNT )
} );

/**
 * The board, and who is playing which mark.
 *
 * - board: The grid, one entry per cell. `null` where nothing has been played
 * - symbols: Which seat holds each mark. Both are absent until someone takes
 * 			them — `onJoin` fills X for the first joiner and O for the second — so
 * 			neither is seeded with a blank id: `PlayerId` is a branded
 * 			`NonEmptyString`, and there is no empty value to stand in
 *
 * How the game came out is not here. That is `Standings`, which `resolveResults`
 * builds off the board and the engine stamps onto the record — a `winner` folded
 * into the state as well could only ever disagree with it, and a client reads
 * the verdict off the `GameView` envelope either way.
 */
export type TicTacToeState = typeof TicTacToeState.Type;
export const TicTacToeState = Schema.Struct( {
	board: Schema.Array( CellValue ),
	symbols: Schema.Struct( {
		X: Schema.optionalKey( PlayerId ),
		O: Schema.optionalKey( PlayerId )
	} )
} );

/**
 * One shape for every audience. Tic-tac-toe hides nothing — the board and the
 * marks are public the moment they are played — so there is no private region to
 * redact and the view is the state as it stands, whoever is watching.
 *
 * - board: The grid, exactly as the state holds it
 * - symbols: Which seat holds each mark
 * - playerId: The seat this view was built for. Absent on the table's, and the
 * 			only thing that varies between one audience's view and another's.
 */
export type TicTacToeView = typeof TicTacToeView.Type;
export const TicTacToeView = Schema.Struct( {
	...TicTacToeState.fields,
	playerId: Schema.optional( PlayerId )
} );

// --- Move Inputs -----------------------------------------------------------

/**
 * The input required to play a mark. The mark itself is not here: it is the
 * caller's own, read off `symbols` at execution.
 * - position: The cell being claimed
 */
export type PlaceInput = typeof PlaceInput.Type;
export const PlaceInput = Schema.Struct( { position: Position } );

/**
 * Every move this game declares, name → input schema.
 *
 * One list, read three times over: the structure builds `schemas.moves` from it,
 * the contract builds the hint endpoint's union of suggestions from it, and the
 * client reads a hint back through TicTacToeHint below. A move added in one of
 * those places and forgotten in another is what having one list prevents.
 */
export const TicTacToeMoveSchemas = {
	place: PlaceInput
};

/** What `GET /api/tictactoe/:gameId/hint` answers with. */
export type TicTacToeHint = HintOf<typeof TicTacToeMoveSchemas>;


/**
 * The input required to initialize a tic-tac-toe game.
 */
export type TicTacToeInitializeInput = typeof TicTacToeInitializeInput.Type;
export const TicTacToeInitializeInput = InitializeInput( TicTacToeConfig );

/**
 * The input required to create a tic-tac-toe game: none. The id, the code and the
 * seed are the server's to pick, and the seat count, the move clock and whether
 * the table starts itself are constants rather than choices — so a client sends
 * an empty body.
 */
export type TicTacToeCreateInput = typeof TicTacToeCreateInput.Type;
export const TicTacToeCreateInput = Schema.Struct( {} );


// --- Domain Events ---------------------------------------------------------

/**
 * Emitted when a seat is taken, giving that player their mark.
 * X goes to the first joiner and O to the second, which is also what fixes the
 * turn order: X opens.
 */
export type SymbolAssigned = typeof SymbolAssigned.Type;
export const SymbolAssigned = Schema.TaggedStruct(
	"tictactoe/ev/SymbolAssigned",
	{ symbol: Symbol, playerId: PlayerId }
);

/**
 * Emitted when a player claims a free cell.
 * Records the mark rather than the player, since `symbols` already pairs the two
 * and the board is read a cell at a time.
 */
export type Placed = typeof Placed.Type;
export const Placed = Schema.TaggedStruct(
	"tictactoe/ev/Placed",
	{ position: Position, symbol: Symbol }
);

/**
 * Union of all the events a tic-tac-toe game emits
 */
export type TicTacToeEvent = typeof TicTacToeEvent.Type;
export const TicTacToeEvent = Schema.Union( [ SymbolAssigned, Placed ] );
