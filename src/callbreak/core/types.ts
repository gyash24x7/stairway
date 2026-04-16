import type { BaseGameConfig, BaseGameData, GameData, GameId, PlayerId } from "@/shared/engine/types";
import type { CardId, CardSuit } from "@/shared/utils/cards";

export type Trick = {
	leadPlayer: PlayerId;
	suit?: CardSuit;
	cards: Record<PlayerId, CardId>;
	winner?: PlayerId;
}

export type DealId = string;
export type Deal = {
	id: DealId;
	phase: "calling" | "playing";
	startingPlayer: PlayerId;
	hands: Record<PlayerId, CardId[]>;
	declarations: Record<PlayerId, number>;
	wins: Record<PlayerId, number>;
	scores: Record<PlayerId, number>;
	tricks: Trick[];
}

export type CallbreakData = {
	deals: Deal[];
	scores: Record<PlayerId, number>;
	winner?: PlayerId;
}

export type CallbreakConfig = BaseGameConfig & { dealCount: number; trumpSuit: CardSuit; }

export type CallbreakPlayerView = Omit<CallbreakData, "deals"> & {
	activeDeal?: Omit<Deal, "hands">;
	hand: CardId[];
	playerId: PlayerId;
}

export type CallbreakGame = BaseGameData & GameData<CallbreakPlayerView, CallbreakConfig>;

export type DeclareWinsInput = {
	gameId: GameId;
	wins: number;
	dealId: DealId;
};

export type PlayCardInput = {
	gameId: GameId;
	cardId: CardId;
	dealId: DealId;
};

export type CallbreakMoves = {
	declareWins: DeclareWinsInput;
	playCard: PlayCardInput;
};
