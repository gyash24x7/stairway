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
import type { AuthContext } from "@stairway/api/utils";
import type { CardSet } from "@stairway/cards";

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

export type LiteratureGameData = { game: Game; players: PlayerData; teams: TeamData; cardCounts: CardCounts }
export type LiteratureContext = AuthContext & LiteratureGameData;

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