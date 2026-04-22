import type { BaseGameConfig, BaseGameData, BasePlayerView, GameData, GameId, PlayerId } from "@/shared/engine/types";
import type { CardId, CardSuit } from "@/shared/utils/cards";

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

/** Player-facing view of the game state, exposing only the active deal and the player's own hand. */
export type CallbreakPlayerView = Omit<CallbreakData, "deals"> & BasePlayerView & {
	activeDeal?: Omit<Deal, "hands">;
	lastCompletedTrick?: Trick;
	hand: CardId[];
}

/** Complete Callbreak game data type combining base game data with player view. */
export type CallbreakGame = BaseGameData & GameData<CallbreakPlayerView, CallbreakConfig>;

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
