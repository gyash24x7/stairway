import type { CardId, CardSuit, PlayingCard } from "@s2h/cards/types";

export type PlayerId = string;
export type BasePlayerInfo = {
	id: string;
	name: string;
	username: string;
	avatar: string;
};
export type Player = BasePlayerInfo & { isBot: boolean; };

export type Round = {
	id: string;
	playerOrder: string[];
	status: "CREATED" | "IN_PROGRESS" | "COMPLETED";
	suit?: CardSuit;
	cards: Record<PlayerId, CardId>;
	winner?: string;
	createdAt: number;
};

export type Deal = {
	id: string;
	playerOrder: string[];
	status: "CREATED" | "IN_PROGRESS" | "COMPLETED";
	hands: Record<PlayerId, PlayingCard[]>;
	declarations: Record<PlayerId, number>;
	wins: Record<PlayerId, number>;
	createdAt: number;
};

export type DealWithRounds = Deal & { rounds: Round[] };
export type PlayerData = Record<string, Player>;

export type GameStatus = "GAME_CREATED"
	| "PLAYERS_READY"
	| "CARDS_DEALT"
	| "WINS_DECLARED"
	| "ROUND_STARTED"
	| "CARDS_PLAYED"
	| "ROUND_COMPLETED"
	| "DEAL_COMPLETED"
	| "GAME_COMPLETED"

export type GameId = string;
export type GameData = {
	id: GameId;
	code: string;
	dealCount: number;
	trump: CardSuit;
	currentTurn: string;
	status: GameStatus;
	scores: Record<string, number[]>;
	createdBy: string;
	players: Record<string, Player>;
	deals: DealWithRounds[];
};

export type PlayerGameInfo = Omit<GameData, "deals"> & {
	playerId: PlayerId;
	currentDeal?: Omit<Deal, "hands">;
	currentRound?: Round;
	hand: PlayingCard[];
};

export type CreateGameInput = {
	dealCount?: 5 | 9 | 13;
	trumpSuit: CardSuit;
};

export type JoinGameInput = {
	code: string;
};

export type DeclareDealWinsInput = {
	wins: number;
	dealId: string;
	gameId: string;
};

export type PlayCardInput = {
	cardId: CardId;
	roundId: string;
	dealId: string;
	gameId: string;
};
