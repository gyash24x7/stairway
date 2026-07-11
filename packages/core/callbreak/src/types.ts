import type {
	BaseGameConfig,
	BasePlayerView,
	GameId,
	PlayerGameData,
	PlayerId,
	SharedGameData
} from "@s2h/engine/types";
import type { CardId, CardSuit } from "@s2h/utils/cards";

/** A single trick in a deal, tracking lead player, suit, cards played, and winner. */
export type Trick = {
	leadPlayer: PlayerId;
	suit?: CardSuit;
	cards: Record<PlayerId, CardId>;
	winner?: PlayerId;
}

/** Unique identifier for a deal. */
export type DealId = string;

/** A complete deal containing hands, declarations, wins, scores, and tricks. */
export type Deal = {
	id: DealId;
	startingPlayer: PlayerId;
	hands: Record<PlayerId, CardId[]>;
	declarations: Record<PlayerId, number>;
	wins: Record<PlayerId, number>;
	scores: Record<PlayerId, number>;
	tricks: Trick[];
}

/** Server-side game state containing all deals and cumulative scores. */
export type CallbreakData = {
	deals: Deal[];
	scores: Record<PlayerId, number>;
	winner?: PlayerId;
}

/** Callbreak game configuration with deal count and trump suit. */
export type CallbreakConfig = BaseGameConfig & { dealCount: number; trumpSuit: CardSuit; }

/** Shared view of the game state visible to all players. */
export type CallbreakSharedView = {
	scores: Record<PlayerId, number>;
	activeDeal?: Omit<Deal, "hands">;
	lastCompletedTrick?: Trick;
	winner?: PlayerId;
};

/** Player-specific view containing only the player's hand. */
export type CallbreakPlayerView = BasePlayerView & {
	hand: CardId[];
};

/** Merged view used by bot AI (shared + player-specific state). */
export type CallbreakBotView = CallbreakSharedView & CallbreakPlayerView;

/** Complete Callbreak game data type with split shared/player state. */
export type CallbreakGame = {
	shared: SharedGameData<CallbreakSharedView, CallbreakConfig>;
	player: PlayerGameData<CallbreakPlayerView>;
};

/** Input for creating a new Callbreak game with deal count and trump suit. */
export type CreateGameInput = {
	dealCount: 5 | 9 | 13;
	trumpSuit: CardSuit;
}

/** Input for declaring the number of tricks a player expects to win. */
export type DeclareWinsInput = {
	gameId: GameId;
	wins: number;
	dealId: DealId;
};

/** Input for playing a card in the current trick. */
export type PlayCardInput = {
	gameId: GameId;
	cardId: CardId;
	dealId: DealId;
};

/** Map of all Callbreak move types to their input types. */
export type CallbreakMoves = {
	declareWins: DeclareWinsInput;
	playCard: PlayCardInput;
};
