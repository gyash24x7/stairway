import type { CardId, CardSuit, PlayingCard } from "@/libs/cards/types";

export namespace Callbreak {
	export type Player = {
		id: string;
		name: string;
		username: string;
		avatar: string;
		isBot: boolean;
	}

	export type Round = {
		id: string;
		playerOrder: string[];
		status: "CREATED" | "IN_PROGRESS" | "COMPLETED";
		suit?: CardSuit;
		cards: Record<string, CardId>;
		winner?: string;
		createdAt: number;
	}

	export type HandData = Record<string, PlayingCard[]>;

	export type Deal = {
		id: string;
		playerOrder: string[];
		status: "CREATED" | "IN_PROGRESS" | "COMPLETED";
		hands: HandData;
		declarations: Record<string, number>;
		wins: Record<string, number>;
		createdAt: number;
	};

	export type DealWithRounds = Deal & { rounds: Round[] };
	export type PlayerData = Record<string, Player>;

	export type Game = {
		id: string;
		code: string;
		dealCount: number;
		trump: CardSuit;
		currentTurn: string;
		status: "CREATED" | "IN_PROGRESS" | "COMPLETED";
		scores: Record<string, number[]>;
		createdBy: string;
	};

	export type GameData = {
		game: Game;
		players: PlayerData;
		deals: DealWithRounds[];
	};

	export type Store = {
		playerId: string;
		game: Game;
		players: PlayerData;
		currentDeal?: Omit<Deal, "hands">;
		currentRound?: Round;
		hand: PlayingCard[];
	}

	export type GameIdInput = {
		gameId: string;
	}

	export type CreateGameInput = {
		dealCount?: number;
		trumpSuit: CardSuit;
	}

	export type JoinGameInput = {
		code: string;
	}

	export type DeclareDealWinsInput = {
		wins: number;
		dealId: string;
		gameId: string;
	}

	export type PlayCardInput = {
		cardId: CardId;
		roundId: string;
		dealId: string;
		gameId: string;
	}

	export type ErrorOnlyResponse = { error?: string };

	export type DataResponse<T> = { data?: T } & ErrorOnlyResponse;
}
