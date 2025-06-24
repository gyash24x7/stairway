import type { CardSet, PlayingCard } from "@/libs/cards/types";

export namespace Literature {
	export type Metrics = {
		totalAsks: number;
		cardsTaken: number;
		cardsGiven: number;
		totalCalls: number;
		successfulCalls: number;
		totalTransfers: number;
	}

	export type Player = {
		id: string;
		name: string;
		avatar: string;
		hand: PlayingCard[];
		teamId?: string;
		isBot: boolean;
		cardCount: number;
		metrics: Metrics;
	};

	export type Team = {
		id: string;
		name: string;
		score: number;
		setsWon: CardSet[];
		members: string[];
	}

	export type Ask = {
		id: string;
		success: boolean;
		description: string;
		playerId: string;
		askedFrom: string;
		cardId: string;
		timestamp: Date;
	}

	export type Call = {
		id: string;
		success: boolean;
		description: string;
		playerId: string;
		cardSet: CardSet;
		actualCall: Record<string, string>;
		correctCall: Record<string, string>;
		timestamp: Date;
	}

	export type Transfer = {
		id: string;
		description: string;
		playerId: string;
		transferTo: string;
		timestamp: Date;
	}

	export type CardLocationForPlayer = {
		playerIds: string[];
		weight: number;
	}

	export type CardLocationsForCard = Record<string, CardLocationForPlayer>; // Record<playerId, CardLocationForPlayer>

	export type GameStatus = "CREATED" | "PLAYERS_READY" | "TEAMS_CREATED" | "IN_PROGRESS" | "COMPLETED";

	export type Game = {
		id: string;
		code: string;
		status: GameStatus;
		playerCount: number;
		currentTurn: string;
	}

	export type InternalPlayerData = Record<string, Player>;
	export type PlayerData = Record<string, Omit<Player, "cardLocations" | "hand">>
	export type TeamData = Record<string, Team>;
	export type CardMappings = Record<string, string>;
	export type CardLocationData = Record<string, CardLocationsForCard>; // Record<cardId, CardLocationsForCard>
	export type MoveType = "ASK" | "CALL" | "TRANSFER";

	export type GameData = {
		game: Game;
		players: InternalPlayerData;
		teams: TeamData;
		cardMappings: CardMappings;
		cardLocations: CardLocationData;
		asks: Ask[];
		calls: Call[];
		transfers: Transfer[];
		lastMoveType?: MoveType;
		lastCall?: Call;
	}

	export type Store = {
		playerId: string;
		game: Game;
		players: PlayerData;
		teams: TeamData;
		hand: PlayingCard[];
		asks: Ask[];
		lastMoveType?: MoveType;
		lastCall?: Call;
	}
}
