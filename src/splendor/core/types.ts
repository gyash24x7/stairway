import type { BaseGameConfig, Match, MatchId, PlayerId } from "@/shared/engine/types";

export type Gem = "diamond" | "sapphire" | "emerald" | "ruby" | "onyx" | "gold";
export type CardLevel = 1 | 2 | 3;
export type Tokens = Record<Gem, number>;
export type Cost = Record<Exclude<Gem, "gold">, number>;

export type CardId = string;
export type Card = {
	id: CardId;
	level: CardLevel;
	points: number;
	cost: Cost;
	bonus: Exclude<Gem, "gold">;
}

export type NobleId = string;
export type Noble = {
	id: NobleId;
	points: number;
	cost: Cost;
}

export type PlayerInfo = {
	tokens: Tokens;
	cards: Card[];
	nobles: Noble[];
	reserved: Card[];
	points: number;
}

export type SplendorData = {
	tokens: Tokens;
	cards: Record<CardLevel, Card[]>;
	nobles: Noble[];
	decks: Record<CardLevel, Card[]>;
	playerData: Record<PlayerId, PlayerInfo>;
}

export type SplendorConfig = BaseGameConfig & { winningPoints: number };

export type SplendorPlayerView = Omit<SplendorData, "decks"> & { playerId: PlayerId };

export type SplendorMatch = Match<SplendorPlayerView, SplendorConfig>

export type CreateMatchInput = {
	playerCount: 2 | 3 | 4;
	winningPoints: number;
}

export type PickTokensInput = {
	matchId: MatchId;
	tokens: Partial<Tokens>;
	returned?: Partial<Tokens>;
}

export type ReserveCardInput = {
	matchId: MatchId;
	cardId: CardId;
	withGold: boolean;
	returnedToken?: Gem;
}

export type PurchaseCardInput = {
	matchId: MatchId;
	cardId: CardId;
	payment: Partial<Tokens>;
}