import type { CardSet, PlayingCard } from "@/libs/cards/types";
import type * as schema from "@/literature/schema";

export namespace Literature {
	export type Player = typeof schema.players.$inferSelect;
	export type Team = typeof schema.teams.$inferSelect;
	export type CardMapping = typeof schema.cardMappings.$inferSelect;
	export type Game = typeof schema.games.$inferSelect;
	export type CardLocation = typeof schema.cardLocations.$inferSelect;
	export type Ask = typeof schema.asks.$inferSelect;
	export type Call = typeof schema.calls.$inferSelect;
	export type Transfer = typeof schema.transfers.$inferSelect;

	export type PlayerData = Record<string, Player>;
	export type TeamData = Record<string, Team>;
	export type CardCounts = Record<string, number>;
	export type ScoreUpdate = { teamId: string; score: number; setWon: CardSet; isLastSet: boolean }
	export type GameStatus = Game["status"];

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

	export type Context = { game: Game; players: PlayerData; teams: TeamData; cardCounts: CardCounts }

	export type PlayerMetrics = {
		playerId: string;
		totalAsks: number;
		cardsTaken: number;
		cardsGiven: number;
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

	export type Event =
		"player-joined"
		| "teams-created"
		| "status-updated"
		| "card-asked"
		| "set-called"
		| "turn-updated"
		| "turn-transferred"
		| "score-updated"
		| "card-count-updated"
		| "game-completed"
		| "cards-dealt";

	export type EventPayloads = {
		"player-joined": Literature.Player;
		"teams-created": Literature.TeamData;
		"status-updated": Literature.GameStatus;
		"card-asked": Literature.Ask;
		"set-called": Literature.Call;
		"turn-updated": string;
		"turn-transferred": Literature.Transfer;
		"score-updated": Literature.ScoreUpdate;
		"card-count-updated": Literature.CardCounts;
		"game-completed": Literature.Metrics
		"cards-dealt": PlayingCard[];
	}

	export type Store = {
		playerId: string;
		game: Game;
		players: PlayerData;
		teams: TeamData;
		cardCounts: CardCounts;
		hand: PlayingCard[];
		lastMoveData?: { move?: Ask | Transfer, isCall: false } | { move: Call, isCall: true };
		asks: Ask[];
		metrics: Metrics;
	}
}

export enum LiteratureEvent {
	PLAYER_JOINED = "player-joined",
	TEAMS_CREATED = "teams-created",
	STATUS_UPDATED = "status-updated",
	CARD_ASKED = "card-asked",
	SET_CALLED = "set-called",
	TURN_UPDATED = "turn-updated",
	TURN_TRANSFERRED = "turn-transferred",
	SCORE_UPDATED = "score-updated",
	CARD_COUNT_UPDATED = "card-count-updated",
	GAME_COMPLETED = "game-completed",
	CARDS_DEALT = "cards-dealt"
}