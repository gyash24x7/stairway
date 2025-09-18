import type { CardId, PlayingCard } from "@/shared/utils/cards";

export type BookType = "NORMAL" | "CANADIAN";
export type PlayerCount = 3 | 4 | 6 | 8;
export type TeamCount = 0 | 2 | 3 | 4;
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

export type GameStatus = "CREATED" | "PLAYERS_READY" | "TEAMS_CREATED" | "IN_PROGRESS" | "COMPLETED";

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
	claim: Partial<Record<CardId, string>>;
};

export type TransferEventInput = {
	gameId: GameId;
	transferTo: string;
};

export type SaveFn = ( gameData: GameData ) => Promise<void>;