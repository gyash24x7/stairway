import type { CardId, PlayingCard } from "@/libs/cards/types";
import type { CANADIAN_FISH_BOOKS, GAME_STATUS, NORMAL_FISH_BOOKS } from "@/libs/fish/constants";

export type FishBookType = "NORMAL" | "CANADIAN";
export type FishPlayerCount = 3 | 4 | 6 | 8;
export type FishTeamCount = 0 | 2 | 3 | 4;
export type CanadianFishBook = keyof typeof CANADIAN_FISH_BOOKS;
export type NormalFishBook = keyof typeof NORMAL_FISH_BOOKS;
export type NormalFishDeckType = 48 | 52;
export type CanadianFishDeckType = 48;

export type FishBook = NormalFishBook | CanadianFishBook;
export type DeckType = NormalFishDeckType | CanadianFishDeckType;

export type FishGameConfig = {
	type: FishBookType;
	playerCount: FishPlayerCount;
	teamCount: FishTeamCount;
	books: NormalFishBook[] | CanadianFishBook[];
	deckType: DeckType;
	allowSolo?: boolean;
}

export type PlayerId = string;
export type BasePlayerInfo = {
	id: PlayerId;
	name: string;
	avatar: string;
}

export type Player = BasePlayerInfo & {
	teamId: TeamId;
	isBot: boolean;
	teamMates: PlayerId[];
	opponents: PlayerId[];
}

export type TeamId = string;
export type Team = {
	id: TeamId;
	name: string;
	players: PlayerId[];
	score: number;
	booksWon: FishBook[];
}

export type GameStatus = keyof typeof GAME_STATUS;

export type CardState = {
	knownOwner?: PlayerId;
	possibleOwners: PlayerId[];
};

export type BookState = {
	cards: CardId[];
	knownOwners: Record<CardId, PlayerId>;
	possibleOwners: Record<CardId, PlayerId[]>;
	knownCounts: Record<PlayerId, number>;
	inferredOwners: Record<CardId, PlayerId>;
}

export type AskEvent = {
	success: boolean;
	description: string;
	playerId: PlayerId;
	askedFrom: PlayerId;
	cardId: CardId;
	timestamp: number;
};

export type ClaimEvent = {
	success: boolean;
	description: string;
	playerId: PlayerId;
	book: FishBook;
	correctClaim: Record<CardId, PlayerId>;
	actualClaim: Record<CardId, PlayerId>;
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
}

export type GameId = string;
export type FishGameData = {
	id: GameId;
	code: string;
	status: GameStatus;
	config: FishGameConfig;
	currentTurn: PlayerId;

	// Player Information
	playerIds: PlayerId[];
	players: Record<PlayerId, Player>;

	// Team Information
	teamIds: TeamId[];
	teams: Record<TeamId, Team>;

	// Card Information
	hands: Record<PlayerId, PlayingCard[]>;
	cardCounts: Record<PlayerId, number>;
	cardMappings: Record<CardId, PlayerId>;
	bookStates: Record<FishBook, BookState>;

	// Game History
	lastMoveType?: "ask" | "claim" | "transfer";
	askHistory: AskEvent[];
	claimHistory: ClaimEvent[];
	transferHistory: TransferEvent[];

	// Game Metrics
	metrics: Record<PlayerId, Metrics>;
}

export type FishPlayerGameInfo = Omit<FishGameData, "hands" | "cardMappings"> & {
	playerId: string;
	hand: PlayingCard[];
}

export type GameIdInput = { gameId: GameId };
export type CreateTeamsInput = GameIdInput & { data: Record<string, PlayerId[]>, teamCount: FishTeamCount; };
export type StartGameInput = GameIdInput & { type: FishBookType; deckType: DeckType; };
export type AskEventInput = GameIdInput & { cardId: CardId; askedFrom: PlayerId; };
export type ClaimEventInput = GameIdInput & { claim: Record<CardId, PlayerId>; };
export type TransferEventInput = GameIdInput & { transferTo: PlayerId; };

export type WeightedBook = {
	book: FishBook;
	weight: number;
	isBookWithTeam: boolean;
	isClaimable: boolean;
	isKnown: boolean;
};
export type WeightedAsk = { cardId: CardId; playerId: PlayerId; weight: number };
export type WeightedClaim = { book: FishBook; claim: Record<CardId, PlayerId>; weight: number; };
export type WeightedTransfer = { weight: number; transferTo: string; };

export type CreateGameInput = {
	playerCount?: FishPlayerCount;
	gameId?: GameId;
	playerId?: PlayerId;
};

export type JoinGameInput = {
	code: string;
	isUserAlreadyInGame?: boolean;
};