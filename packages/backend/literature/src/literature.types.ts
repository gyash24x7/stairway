import { CardHand, type CardSet } from "@common/cards";
import type { cardLocations, cardMappings, games, gameStatuses, moves, players, teams } from "./literature.schema.ts";

export type Player = typeof players.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type CardMapping = typeof cardMappings.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Move = typeof moves.$inferSelect;
export type CardLocation = typeof cardLocations.$inferSelect

export type PlayerData = Record<string, Player>;
export type TeamData = Record<string, Team>;
export type CardMappingData = Record<string, string>;
export type HandData = Record<string, CardHand>;
export type CardLocationsData = Record<string, CardLocation[]>;
export type CardsData = { mappings: CardMappingData; hands: HandData }
export type CardCounts = Record<string, number>;
export type ScoreUpdate = { teamId: string; score: number; setWon: CardSet; }

export type AskMoveData = { from: string; by: string; card: string; }
export type TransferMoveData = { from: string; to: string; }
export type CallMoveData = {
	by: string;
	cardSet: string;
	actualCall: Record<string, string>;
	correctCall: Record<string, string>;
}

export type AskMove = Omit<Move, "data"> & { data: AskMoveData };
export type CallMove = Omit<Move, "data"> & { data: CallMoveData };
export type TransferMove = Omit<Move, "data"> & { data: TransferMoveData };

export type RawGameData = Game & {
	players: Player[],
	teams?: Team[],
	cardMappings?: CardMapping[],
	moves?: Move[]
}

export type GameStatus = typeof gameStatuses[number];

export type GameData = {
	id: string;
	code: string;
	status: GameStatus;
	playerCount: number;
	currentTurn: string;
	players: PlayerData;
	teams: TeamData;
	cardCounts: CardCounts;
	moves: Move[];
}
