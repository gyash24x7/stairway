import type { BaseGameConfig, BaseGameData, BasePlayerView, GameData, GameId, PlayerId } from "@/shared/engine/types";

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
	winner?: PlayerId;
}

export type SplendorConfig = BaseGameConfig & { playerCount: 2 | 3 | 4; winningPoints: number };

export type SplendorPlayerView = Omit<SplendorData, "decks"> & BasePlayerView;

export type SplendorGame = BaseGameData & GameData<SplendorPlayerView, SplendorConfig>;

export type PickTokensInput = {
	gameId: GameId;
	tokens: Partial<Tokens>;
	returned?: Partial<Tokens>;
}

export type ReserveCardInput = {
	gameId: GameId;
	cardId: CardId;
	withGold: boolean;
	returnedToken?: Gem;
}

export type PurchaseCardInput = {
	gameId: GameId;
	cardId: CardId;
	payment: Partial<Tokens>;
}

export type SplendorMoves = {
	pickTokens: PickTokensInput;
	reserveCard: ReserveCardInput;
	purchaseCard: PurchaseCardInput;
};