import type { Match, MatchId, PlayerId } from "@/shared/engine/types";
import type { CardId } from "@/shared/utils/cards";

export type BookType = "NORMAL" | "CANADIAN";
export type PlayerCount = 4 | 6 | 8;
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

export type Ask = {
	success: boolean;
	playerId: PlayerId;
	from: PlayerId;
	cardId: CardId;
	timestamp: number;
};

export type Claim = {
	success: boolean;
	playerId: PlayerId;
	book: Book;
	correctClaim: Partial<Record<CardId, PlayerId>>;
	actualClaim: Partial<Record<CardId, PlayerId>>;
	timestamp: number;
};

export type Transfer = {
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

export type TeamId = string;
export type Team = {
	id: TeamId;
	name: string;
	members: PlayerId[];
	score: number;
	booksWon: Book[];
}

export type PlayerInfo = {
	teamId: TeamId;
	metrics: Metrics;
};

export type PlayerData = Record<PlayerId, PlayerInfo>;
export type TeamData = Record<TeamId, Team>;
export type HandData = Record<PlayerId, CardId[]>;
export type CardCounts = Record<PlayerId, number>;
export type CardLocations = Partial<Record<CardId, PlayerId[]>>;

export type FishData = {
	playerData: PlayerData;
	teams: TeamData;
	hands: HandData;
	cardCounts: CardCounts;
	cardLocations: CardLocations;
	lastMoveType?: "ask" | "claim" | "transfer";
	askHistory: Ask[];
	claimHistory: Claim[];
	transferHistory: Transfer[];
};

export type FishConfig = {
	type: BookType;
	playerCount: PlayerCount;
	teamCount: TeamCount;
	deckType: DeckType;
	books: Book[];
	bookSize: BookSize;
	autoStart?: boolean;
};

export type FishPlayerView = Omit<FishData, "hands"> & {
	playerId: string;
	hand: CardId[];
};

export type FishMatch = Match<FishPlayerView, FishConfig>;

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
	teams: Record<string, PlayerId[]>;
	matchId: MatchId;
};

export type AskCardInput = {
	matchId: MatchId;
	from: PlayerId;
	cardId: CardId;
};

export type ClaimBookInput = {
	claim: Partial<Record<CardId, string>>;
	matchId: MatchId;
};

export type TransferTurnInput = {
	transferTo: PlayerId;
	matchId: MatchId;
};
