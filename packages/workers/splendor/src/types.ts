import type { SplendorEngine } from "./engine.ts";

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

export type PlayerId = string;
export type BasePlayerInfo = {
	id: PlayerId;
	name: string;
	username: string;
	avatar: string;
}
export type Player = BasePlayerInfo & {
	tokens: Tokens;
	cards: Card[];
	nobles: Noble[];
	reserved: Card[];
	points: number;
	isBot: boolean;
}

export type GameId = string;
export type GameData = {
	id: GameId;
	code: string;
	status: "CREATED" | "PLAYERS_READY" | "IN_PROGRESS" | "COMPLETED";
	playerCount: 2 | 3 | 4;
	players: Record<PlayerId, Player>;
	tokens: Tokens;
	cards: Record<CardLevel, ( Card | undefined )[]>;
	nobles: Noble[];
	currentTurn: PlayerId;
	playerOrder: PlayerId[];
	decks: Record<CardLevel, Card[]>;
	createdBy: string;
	isLastRound?: boolean;
	winner?: PlayerId;
}

export type PlayerGameInfo = Omit<GameData, "decks"> & { playerId: PlayerId };

export type CreateGameInput = {
	playerCount: 2 | 3 | 4;
}

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

export type Bindings = {
	SPLENDOR_DO: DurableObjectNamespace<SplendorEngine>;
	SPLENDOR_KV: KVNamespace;
	WSS: DurableObjectNamespace<import("../../../../apps/web/src/wss.ts").WebsocketServer>;
}

export type Context = { env: Bindings } & { authInfo: BasePlayerInfo };