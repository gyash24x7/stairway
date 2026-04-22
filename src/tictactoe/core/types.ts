import type { BaseGameConfig, BaseGameData, BasePlayerView, GameData, GameId, PlayerId } from "@/shared/engine/types";

/** A cell on the board: "X", "O", or null (empty). */
export type CellValue = "X" | "O" | null;

/** The 3x3 board represented as a flat 9-element array. */
export type Board = CellValue[];

/** Server-side game state with board, symbol assignments, and optional winner. */
export type TicTacToeData = {
	board: Board;
	symbols: Record<"X" | "O", PlayerId>;
	winner?: "draw" | PlayerId;
};

/** Player view of the game state (identical to full state since Tic-Tac-Toe has no hidden info). */
export type TicTacToePlayerView = TicTacToeData & BasePlayerView;

/** Complete Tic-Tac-Toe game data type. */
export type TicTacToeGame = BaseGameData & GameData<TicTacToePlayerView, BaseGameConfig>

/** Input for placing a symbol on the board at a position (0-8). */
export type PlaceInput = { gameId: GameId; position: number; };

/** Map of Tic-Tac-Toe move types to their input types. */
export type TicTacToeMoves = { place: PlaceInput };