import type { BaseGameConfig, Match, MatchId, PlayerId } from "@/shared/engine/types";
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
}

export type CallbreakConfig = BaseGameConfig & { dealCount: number; trumpSuit: CardSuit; }

export type CallbreakPlayerView = Omit<CallbreakData, "deals"> & {
	activeDeal?: Omit<Deal, "hands">;
	hand: CardId[];
	playerId: PlayerId;
}

export type CallbreakMatch = Match<CallbreakPlayerView, CallbreakConfig>;

export type DeclareWinsInput = {
	matchId: MatchId;
	wins: number;
	dealId: DealId;
};

export type PlayCardInput = {
	matchId: MatchId;
	cardId: CardId;
	dealId: DealId;
};
