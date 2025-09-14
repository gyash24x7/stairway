import type { CardId, PlayingCard } from "@/utils/cards";
import type { CANADIAN_BOOKS, GAME_STATUS, NORMAL_BOOKS } from "@/workers/fish/utils";

export type BookType = "NORMAL" | "CANADIAN";
export type PlayerCount = 3 | 4 | 6 | 8;
export type TeamCount = 0 | 2 | 3 | 4;
export type CanadianBook = keyof typeof CANADIAN_BOOKS;
export type NormalBook = keyof typeof NORMAL_BOOKS;
export type Book = NormalBook | CanadianBook;
export type DeckType = 48 | 52;

export type GameConfig = {
	type: BookType;
	playerCount: PlayerCount;
	teamCount: TeamCount;
	deckType: DeckType;
	books: Book[];
	allowSolo?: boolean;
};

export type PlayerId = string;
export type Player = {
	id: PlayerId;
	name: string;
	username: string;
	avatar: string;
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

export type GameStatus = keyof typeof GAME_STATUS;

export type BookState = {
	cards: CardId[];
	knownOwners: Partial<Record<CardId, PlayerId>>;
	possibleOwners: Partial<Record<CardId, PlayerId[]>>;
	knownCounts: Record<PlayerId, number>;
	inferredOwners: Partial<Record<CardId, PlayerId>>;
};

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
	playerIds: PlayerId[];
	players: Record<PlayerId, Player>;
	teamIds: TeamId[];
	teams: Record<TeamId, Team>;
	hands: Record<PlayerId, CardId[]>;
	cardCounts: Record<PlayerId, number>;
	cardMappings: Record<CardId, string>;
	bookStates: Record<Book, BookState>;
	lastMoveType?: "ask" | "claim" | "transfer";
	askHistory: AskEvent[];
	claimHistory: ClaimEvent[];
	transferHistory: TransferEvent[];
	metrics: Record<PlayerId, Metrics>;
};

export type PlayerGameInfo = Omit<GameData, "hands" | "cardMappings"> & {
	playerId: string;
	hand: PlayingCard[];
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
	claim: Partial<Record<CardId, string>>;
	weight: number;
};

export type WeightedTransfer = {
	weight: number;
	transferTo: string;
};

export type CreateGameInput = {
	playerCount?: PlayerCount;
};

export type JoinGameInput = {
	code: string;
};

export type GameIdInput = { gameId: GameId };

export type CreateTeamsInput = {
	gameId: GameId;
	data: Record<string, PlayerId[]>;
};

export type StartGameInput = {
	gameId: GameId;
	type: BookType;
	deckType: DeckType;
};

export type AskEventInput = {
	gameId: GameId;
	from: string;
	cardId: CardId;
};

export type ClaimEventInput = {
	gameId: GameId;
	claim: Record<CardId, string>;
};

export type TransferEventInput = {
	gameId: GameId;
	transferTo: string;
};
