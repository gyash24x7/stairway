import type { CardSet, PlayingCard } from "@stairway/cards";
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
} from "@stairway/prisma";

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

	export type GameEvent =
		"player-joined"
		| "teams-created"
		| "status-updated"
		| "card-asked"
		| "set-called"
		| "turn-updated"
		| "turn-transferred"
		| "score-updated"
		| "card-count-updated"
		| "game-completed";

	export type PlayerEvent = "cards-dealt";

	export type GameEventPayloads = {
		"player-joined": Literature.Player;
		"teams-created": Literature.TeamData;
		"status-updated": Literature.GameStatus;
		"card-asked": Literature.Ask;
		"set-called": Literature.Call;
		"turn-updated": string;
		"turn-transferred": Literature.Transfer;
		"score-updated": Literature.ScoreUpdate;
		"card-count-updated": Literature.CardCounts;
		"game-completed": Literature.Metrics;
	}

	export type PlayerEventPayloads = {
		"cards-dealt": PlayingCard[];
	}

	export type ClientEvent<E extends GameEvent | PlayerEvent> = {
		event: E;
		data: E extends GameEvent
			? GameEventPayloads[E]
			: E extends PlayerEvent
				? PlayerEventPayloads[E]
				: never;
	}

	export type ClientEvents = ClientEvent<"player-joined">
		| ClientEvent<"teams-created">
		| ClientEvent<"cards-dealt">
		| ClientEvent<"card-asked">
		| ClientEvent<"set-called">
		| ClientEvent<"turn-transferred">
		| ClientEvent<"turn-updated">
		| ClientEvent<"score-updated">
		| ClientEvent<"card-count-updated">
		| ClientEvent<"status-updated">
		| ClientEvent<"game-completed">
}