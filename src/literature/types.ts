import type { CardSet, PlayingCard } from "@/shared/cards/types";
import type {
	LiteratureAsk,
	LiteratureCall,
	LiteratureCardLocation,
	LiteratureCardMapping,
	LiteratureGame,
	LiteratureGameStatus,
	LiteraturePlayer,
	LiteratureTeam,
	LiteratureTransfer
} from "@prisma/client";

export namespace Literature {
	export type Player = LiteraturePlayer
	export type Team = LiteratureTeam
	export type CardMapping = LiteratureCardMapping
	export type Game = LiteratureGame
	export type CardLocation = LiteratureCardLocation
	export type Ask = LiteratureAsk
	export type Call = LiteratureCall
	export type Transfer = LiteratureTransfer

	export type PlayerData = Record<string, Player>;
	export type TeamData = Record<string, Team>;
	export type CardCounts = Record<string, number>;
	export type ScoreUpdate = { teamId: string; score: number; setWon: CardSet; isLastSet: boolean }
	export type GameStatus = LiteratureGameStatus;

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