import type {
	BaseGameConfig,
	BasePlayerView,
	GameId,
	PlayerGameData,
	PlayerId,
	SharedGameData
} from "@/shared/engine/types";

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

/** Shared view of the game state (all state is public in Tic-Tac-Toe). */
export type TicTacToeSharedView = TicTacToeData;

/** Player view (no private info beyond playerId). */
export type TicTacToePlayerView = BasePlayerView;

/** Complete Tic-Tac-Toe game data type with split shared/player state. */
export type TicTacToeGame = {
	shared: SharedGameData<TicTacToeSharedView, BaseGameConfig>;
	player: PlayerGameData<TicTacToePlayerView>;
};

/** Input for placing a symbol on the board at a position (0-8). */
export type PlaceInput = { gameId: GameId; position: number; };

/** Map of Tic-Tac-Toe move types to their input types. */
export type TicTacToeMoves = { place: PlaceInput };