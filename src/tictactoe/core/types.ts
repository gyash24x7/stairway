import type { BaseGameConfig, Match, MatchId, PlayerId } from "@/shared/engine/types";

export type CellValue = "X" | "O" | null;
export type Board = CellValue[];

export type TicTacToeData = { board: Board; symbols: Record<PlayerId, CellValue>; };
export type TicTacToePlayerView = TicTacToeData & { playerId: PlayerId };

export type TicTacToeMatch = Match<TicTacToePlayerView, BaseGameConfig>

export type PlaceInput = { matchId: MatchId; position: number; };