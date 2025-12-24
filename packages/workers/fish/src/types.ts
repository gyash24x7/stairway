import type { CardId } from "@s2h/utils/cards";
import type { FishEngine } from "./engine.ts";

export type BookType = "NORMAL" | "CANADIAN";
export type PlayerCount = 3 | 4 | 6 | 8;
export type TeamCount = 2 | 3 | 4;
export type CanadianBook = "LC" | "LD" | "LH" | "LS" | "UC" | "UD" | "UH" | "US";
export type NormalBook =
	"ACES"
	| "TWOS"
	| "THREES"
	| "FOURS"
	| "FIVES"
	| "SIXES"
	| "SEVENS"
	| "EIGHTS"
	| "NINES"
	| "TENS"
	| "JACKS"
	| "QUEENS"
	| "KINGS";
export type Book = NormalBook | CanadianBook;
export type DeckType = 48 | 52;
export type BookSize = 4 | 6;

export type GameConfig = {
	type: BookType;
	playerCount: PlayerCount;
	teamCount: TeamCount;
	deckType: DeckType;
	books: Book[];
	bookSize: BookSize;
};

export type PlayerId = string;
export type BasePlayerInfo = {
	id: PlayerId;
	name: string;
	username: string;
	avatar: string;
};

export type Player = BasePlayerInfo & {
	teamId: TeamId;
	isBot: boolean;
	teamMates: PlayerId[];
	opponents: PlayerId[];
};

export type TeamId = string;
export type Team = {
	id: TeamId;
	name: string;
	players: PlayerId[];
	score: number;
	booksWon: Book[];
};

export type GameStatus = "CREATED" | "PLAYERS_READY" | "TEAMS_CREATED" | "IN_PROGRESS" | "COMPLETED";

export type AskEvent = {
	success: boolean;
	description: string;
	playerId: PlayerId;
	from: PlayerId;
	cardId: CardId;
	timestamp: number;
};

export type ClaimEvent = {
	success: boolean;
	description: string;
	playerId: PlayerId;
	book: Book;
	correctClaim: Partial<Record<CardId, PlayerId>>;
	actualClaim: Partial<Record<CardId, PlayerId>>;
	timestamp: number;
};

export type TransferEvent = {
	description: string;
	playerId: PlayerId;
	transferTo: PlayerId;
	timestamp: number;
};

export type Metrics = {
	totalAsks: number;
	cardsTaken: number;
	cardsGiven: number;
	totalClaims: number;
	successfulClaims: number;
};

export type GameId = string;
export type GameData = {
	id: GameId;
	code: string;
	status: GameStatus;
	config: GameConfig;
	currentTurn: PlayerId;
	createdBy: PlayerId;
	playerIds: PlayerId[];
	players: Record<PlayerId, Player>;
	teamIds: TeamId[];
	teams: Record<TeamId, Team>;
	hands: Record<PlayerId, CardId[]>;
	cardCounts: Record<PlayerId, number>;
	cardMappings: Partial<Record<CardId, PlayerId>>;
	cardLocations: Partial<Record<CardId, PlayerId[]>>;
	lastMoveType?: "ask" | "claim" | "transfer";
	askHistory: AskEvent[];
	claimHistory: ClaimEvent[];
	transferHistory: TransferEvent[];
	metrics: Record<PlayerId, Metrics>;
};

export type PlayerGameInfo = Omit<GameData, "hands" | "cardMappings"> & {
	playerId: string;
	hand: CardId[];
};

export type WeightedBook = {
	book: Book;
	weight: number;
	isBookWithTeam: boolean;
	isClaimable: boolean;
	isKnown: boolean;
};

export type WeightedAsk = {
	cardId: CardId;
	playerId: string;
	weight: number;
};

export type WeightedClaim = {
	book: Book;
	claim: Partial<Record<CardId, PlayerId>>;
	weight: number;
};

export type WeightedTransfer = {
	weight: number;
	transferTo: PlayerId;
};

export type CreateGameInput = {
	playerCount: PlayerCount;
	type: BookType;
	teamCount: TeamCount;
};

export type CreateTeamsInput = {
	teams: Record<string, PlayerId[ ]>;
	gameId: GameId;
};

export type AskCardInput = {
	gameId: GameId;
	from: PlayerId;
	cardId: CardId;
};

export type ClaimBookInput = {
	claim: Partial<Record<CardId, string>>;
	gameId: GameId;
};

export type TransferTurnInput = {
	transferTo: PlayerId;
	gameId: GameId;
};

export type Bindings = {
	FISH_DO: DurableObjectNamespace<FishEngine>;
	FISH_KV: KVNamespace;
	WSS: DurableObjectNamespace<import("../../../../apps/web/src/wss.ts").WebsocketServer>;
}

export type Context = { env: Bindings } & { authInfo: BasePlayerInfo };