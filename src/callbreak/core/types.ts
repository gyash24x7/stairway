import type { BaseGameConfig, BaseGameData, BasePlayerView, GameData, GameId, PlayerId } from "@/shared/engine/types";
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

export type CallbreakPlayerView = Omit<CallbreakData, "deals"> & BasePlayerView & {
	activeDeal?: Omit<Deal, "hands">;
	lastCompletedTrick?: Trick;
	hand: CardId[];
}

export type CallbreakGame = BaseGameData & GameData<CallbreakPlayerView, CallbreakConfig>;

export type CreateGameInput = {
	dealCount: 5 | 9 | 13;
	trumpSuit: CardSuit;
}

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
