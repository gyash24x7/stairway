import type { AuthContext } from "@shared/api";
import { type CardSet } from "@stairway/cards";
import {
	asks,
	calls,
	cardLocations,
	cardMappings,
	games,
	gameStatuses,
	players,
	teams,
	transfers
} from "./literature.schema.ts";

export type Player = typeof players.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type CardMapping = typeof cardMappings.$inferSelect;
export type Game = typeof games.$inferSelect;
export type CardLocation = typeof cardLocations.$inferSelect;
export type Ask = typeof asks.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;

export type PlayerData = Record<string, Player>;
export type TeamData = Record<string, Team>;
export type CardCounts = Record<string, number>;
export type ScoreUpdate = { teamId: string; score: number; setWon: CardSet; isLastSet: boolean }
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
	asks: Ask[];
	isLastMoveSuccessfulCall: boolean;
	lastMove: { description: string };
}

export type LiteratureGameData = { game: Game; players: PlayerData; teams: TeamData; cardCounts: CardCounts }
export type LiteratureContext = AuthContext & LiteratureGameData;

export type PlayerMetrics = {
	playerId: string;
	totalAsks: number;
	successfulAsks: number;
	totalCalls: number;
	successfulCalls: number;
	totalTransfers: number;
}

export type TeamMetrics = {
	teamId: string;
	score: number;
	setsWon: string[];
}

export type Metrics = {
	player: PlayerMetrics[];
	team: TeamMetrics[];
}