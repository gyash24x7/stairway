import type { CardSet, PlayingCard } from "@common/cards";

export type User = {
	id: string;
	name: string;
	email: string;
	avatar: string;
}

export type Player = {
	id: string;
	name: string;
	avatar: string;
	gameId: string;
	isBot: boolean;
	teamId: string | null;
}

export type Team = {
	id: string;
	gameId: string;
	name: string;
	score: number;
	setsWon: string[];
	memberIds: string[];
}

export type CardMapping = {
	cardId: string;
	playerId: string;
	gameId: string;
}

export type Inference = {
	playerId: string;
	gameId: string;
	activeSets: Record<string, string[]>;
	actualCardLocations: Record<string, string>;
	possibleCardLocations: Record<string, string[]>;
	inferredCardLocations: Record<string, string>;
}

export type GameStatus = "CREATED" | "PLAYERS_READY" | "TEAMS_CREATED" | "IN_PROGRESS" | "COMPLETED";

export type Game = {
	id: string;
	code: string;
	status: GameStatus;
	playerCount: number;
	currentTurn: string;
}

export type GameWithPlayers = Game & { players: Player[] };

export type PlayerData = Record<string, Player>;

export type InferenceData = Record<string, Inference>;

export type TeamData = Record<string, Team>;

export type CardMappingData = Record<string, string>;

export type HandData = Record<string, PlayingCard[]>;

export type CardsData = {
	mappings: CardMappingData;
	hands: HandData
}

export type CardCounts = Record<string, number>;

export type ScoreUpdate = {
	teamId: string;
	score: number;
	setWon: CardSet;
}

export type AskMoveData = {
	from: string;
	by: string;
	card: string;
}

export type CallMoveData = {
	by: string;
	cardSet: string;
	actualCall: Record<string, string>;
	correctCall: Record<string, string>;
}

export type TransferMoveData = {
	from: string;
	to: string;
}

export type MoveType = "ASK_CARD" | "CALL_SET" | "TRANSFER_TURN";

export type Move = {
	id: string;
	gameId: string;
	timestamp: Date;
	type: MoveType;
	description: string;
	success: boolean;
	data: AskMoveData | CallMoveData | TransferMoveData;
}

export type AskMove = Omit<Move, "data"> & { data: AskMoveData };

export type CallMove = Omit<Move, "data"> & { data: CallMoveData };

export type TransferMove = Omit<Move, "data"> & { data: TransferMoveData };

export type RawGameData = Game & {
	players: Player[],
	teams: Team[],
	cardMappings: CardMapping[],
	moves: Move[]
}

export type GameData = {
	id: string;
	code: string;
	status: GameStatus;
	playerCount: number;
	currentTurn: string;
	players: PlayerData;
	teams: TeamData;
	cardCounts: CardCounts;
	moves: Move[];
}

export type PlayerSpecificData = {
	id: string;
	name: string;
	avatar: string;
	teamId?: string | null;
	isBot: boolean;
	hand: PlayingCard[];
	cardSets: CardSet[];
	oppositeTeamId?: string;
}

export type CreateGameInput = {
	playerCount: number;
}

export type JoinGameInput = {
	code: string;
}

export type CreateTeamsInput = {
	data: { [ key: string ]: string[] };
}

export type AskCardInput = {
	askedFrom: string;
	askedFor: string;
}

export type CallSetInput = {
	data: { [ key: string ]: string };
}

export type TransferTurnInput = {
	transferTo: string;
}