import type {
	BasePlayerView,
	GameId,
	PlayerGameData,
	PlayerId,
	SharedGameData
} from "@s2h/engine/types";
import type { CardId } from "@s2h/shared/utils/cards";

/** The variant of book grouping used in the game. */
export type BookType = "NORMAL" | "CANADIAN";

/** Supported player counts for Fish games. */
export type PlayerCount = 4 | 6 | 8;

/** Supported team counts for Fish games. */
export type TeamCount = 2 | 3 | 4;

/** Canadian book names representing suit halves (L=low A-6, U=high 8-K). */
export type CanadianBook = "LC" | "LD" | "LH" | "LS" | "UC" | "UD" | "UH" | "US";

/** Normal book names representing card ranks (all four suits per rank). */
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

/** Union of all book name types. */
export type Book = NormalBook | CanadianBook;

/** Deck size: 48 for Canadian (no 7s) or 52 for normal. */
export type DeckType = 48 | 52;

/** Number of cards per book: 4 for normal, 6 for Canadian. */
export type BookSize = 4 | 6;

/** Record of an ask action: one player asking another for a specific card. */
export type Ask = {
	success: boolean;
	playerId: PlayerId;
	from: PlayerId;
	cardId: CardId;
	timestamp: number;
};

/** Record of a book claim: a player declaring who holds each card in a book. */
export type Claim = {
	success: boolean;
	playerId: PlayerId;
	book: Book;
	correctClaim: Partial<Record<CardId, PlayerId>>;
	actualClaim: Partial<Record<CardId, PlayerId>>;
	timestamp: number;
};

/** Record of a turn transfer to a teammate. */
export type Transfer = {
	playerId: PlayerId;
	transferTo: PlayerId;
	timestamp: number;
};

/** Per-player performance metrics tracked during the game. */
export type Metrics = {
	totalAsks: number;
	cardsTaken: number;
	cardsGiven: number;
	totalClaims: number;
	successfulClaims: number;
};

/** Unique identifier for a team. */
export type TeamId = string;

/** A team with its members, score, and books won. */
export type Team = {
	id: TeamId;
	name: string;
	members: PlayerId[];
	score: number;
	booksWon: Book[];
}

/** Per-player data with team assignment and metrics. */
export type PlayerInfo = {
	teamId: TeamId;
	metrics: Metrics;
};

/** Map of player IDs to their game info. */
export type PlayerData = Record<PlayerId, PlayerInfo>;

/** Map of team IDs to team objects. */
export type TeamData = Record<TeamId, Team>;

/** Map of player IDs to their hands. */
export type HandData = Record<PlayerId, CardId[]>;

/** Map of player IDs to their current card count. */
export type CardCounts = Record<PlayerId, number>;

/** Map of card IDs to the list of players who could possibly hold them. */
export type CardLocations = Partial<Record<CardId, PlayerId[]>>;

/** Server-side Fish game state with hands, teams, card tracking, and action history. */
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
	winningTeam?: TeamId;
};

/** Fish game configuration specifying variant, team structure, and book definitions. */
export type FishConfig = {
	type: BookType;
	playerCount: PlayerCount;
	teamCount: TeamCount;
	deckType: DeckType;
	books: Book[];
	bookSize: BookSize;
	autoStart?: boolean;
};

/** Shared view of the game state (hands hidden). */
export type FishSharedView = Omit<FishData, "hands">;

/** Player-specific view containing only the player's hand. */
export type FishPlayerView = BasePlayerView & { hand: CardId[]; };

/** Merged view used by bot AI (shared + player-specific state). */
export type FishBotView = FishSharedView & FishPlayerView;

/** Complete Fish game data type with split shared/player state. */
export type FishGame = {
	shared: SharedGameData<FishSharedView, FishConfig>;
	player: PlayerGameData<FishPlayerView>;
};

/** A book with a calculated priority weight for bot decision-making. */
export type WeightedBook = {
	book: Book;
	weight: number;
	isBookWithTeam: boolean;
	isClaimable: boolean;
	isKnown: boolean;
};

/** An ask proposal with a calculated priority weight for bot decision-making. */
export type WeightedAsk = {
	cardId: CardId;
	playerId: string;
	weight: number;
};

/** A claim proposal with a calculated confidence weight for bot decision-making. */
export type WeightedClaim = {
	book: Book;
	claim: Partial<Record<CardId, PlayerId>>;
	weight: number;
};

/** A transfer target with a calculated weight for bot decision-making. */
export type WeightedTransfer = {
	weight: number;
	transferTo: PlayerId;
};

/** A detected signal pattern suggesting a teammate likely holds a specific card. */
export type TeammateSignal = {
	cardId: CardId;
	likelyHolder: PlayerId;
	book: Book;
	confidence: number;
};

/** Input for creating a game */
export type CreateGameInput = {
	playerCount: PlayerCount;
	teamCount: TeamCount;
	type: BookType;
};

/** Input for creating team assignments. */
export type CreateTeamsInput = {
	teams: Record<string, PlayerId[]>;
	gameId: GameId;
};

/** Input for asking an opponent for a specific card. */
export type AskCardInput = {
	gameId: GameId;
	from: PlayerId;
	cardId: CardId;
};

/** Input for claiming a book by declaring who holds each card. */
export type ClaimBookInput = {
	claim: Partial<Record<CardId, string>>;
	gameId: GameId;
};

/** Input for transferring the turn to a teammate. */
export type TransferTurnInput = {
	transferTo: PlayerId;
	gameId: GameId;
};

/** Map of all Fish move types to their input types. */
export type FishMoves = {
	createTeams: CreateTeamsInput;
	askCard: AskCardInput;
	claimBook: ClaimBookInput;
	transferTurn: TransferTurnInput;
};
