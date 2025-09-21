import type { CardId, CardSuit, PlayingCard } from "@/shared/utils/cards";

export type PlayerId = string;
export type Player = {
	id: string;
	name: string;
	username: string;
	avatar: string;
	isBot: boolean;
};

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

export type GameData = {
	id: string;
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
	playerId: string;
	currentDeal?: Omit<Deal, "hands">;
	currentRound?: Round;
	hand: PlayingCard[];
};

export type GameIdInput = {
	gameId: string;
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

export type SaveFn = ( game: GameData ) => Promise<void>;
export type AlarmFn = ( ms: number ) => Promise<void>;