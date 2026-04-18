import type { BaseGameConfig, BaseGameData, BasePlayerView, GameData, GameId, PlayerId } from "@/shared/engine/types";

export type CellValue = "X" | "O" | null;
export type Board = CellValue[];

export type TicTacToeData = {
	board: Board;
	symbols: Record<"X" | "O", PlayerId>;
	winner?: "draw" | PlayerId;
};

export type TicTacToePlayerView = TicTacToeData & BasePlayerView;

export type TicTacToeGame = BaseGameData & GameData<TicTacToePlayerView, BaseGameConfig>

export type PlaceInput = { gameId: GameId; position: number; };

export type TicTacToeMoves = { place: PlaceInput };