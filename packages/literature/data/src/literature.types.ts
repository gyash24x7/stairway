import type { CardSet, PlayingCard } from "@common/cards";
import type {
	literatureCardLocations,
	literatureCardMappings,
	literatureGames,
	literatureGameStatuses,
	literatureMoves,
	literaturePlayers,
	literatureTeams
} from "./literature.schema";

export type Player = typeof literaturePlayers.$inferSelect;
export type Team = typeof literatureTeams.$inferSelect;
export type CardMapping = typeof literatureCardMappings.$inferSelect;
export type Game = typeof literatureGames.$inferSelect;
export type Move = typeof literatureMoves.$inferSelect;
export type CardLocation = typeof literatureCardLocations.$inferSelect

export type PlayerData = Record<string, Player>;
export type TeamData = Record<string, Team>;
export type CardMappingData = Record<string, string>;
export type HandData = Record<string, PlayingCard[]>;
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

export type GameStatus = typeof literatureGameStatuses[number];

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
