import type { CardSet, PlayingCard } from "@s2h/cards";
import type {
	LiteratureCardMapping,
	LiteratureGame,
	LiteratureGameStatus,
	LiteratureMove,
	LiteraturePlayer,
	LiteratureTeam
} from "@prisma/client";

export type Game = LiteratureGame;

export type Move = LiteratureMove;

export type Player = LiteraturePlayer;

export type Team = LiteratureTeam;

export type CardMapping = LiteratureCardMapping;

export type TeamWithMembers = Team & { members: string[] };

export type GameWithPlayers = Game & { players: Player[] };

export type PlayerData = Record<string, Player>;

export type CardInferences = Record<string, string[]>;

export type InferenceData = Record<string, CardInferences>;

export type TeamData = Record<string, TeamWithMembers>;

export type CardMappingData = Record<string, string>;

export type HandData = Record<string, PlayingCard[]>;

export type CardCounts = Record<string, number>;

export type ScoreUpdate = {
	teamId: string;
	score: number;
	setWon: CardSet;
}

export enum GameStatus {
	CREATED = "CREATED",
	PLAYERS_READY = "PLAYERS_READY",
	TEAMS_CREATED = "TEAMS_CREATED",
	IN_PROGRESS = "IN_PROGRESS",
	COMPLETED = "COMPLETED"
}

export enum MoveType {
	ASK_CARD = "ASK_CARD",
	CALL_SET = "CALL_SET",
	TRANSFER_CHANCE = "TRANSFER_CHANCE"
}

export type AskMoveData = {
	from: string;
	by: string;
	card: string;
}

export type CallMoveData = {
	by: string;
	cardSet: CardSet;
	actualCall: Record<string, string>;
	correctCall: Record<string, string>;
}

export type TransferMoveData = {
	from: string;
	to: string;
}

export type AskMove = Move & { data: AskMoveData };

export type CallMove = Move & { data: CallMoveData };

export type TransferMove = Move & { data: TransferMoveData };

export type RawGameData = Game & { players: Player[], teams?: Team[], cardMappings?: CardMapping[], moves?: Move[] }

export type GameData = {
	id: string;
	code: string;
	status: LiteratureGameStatus;
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
	inferences: CardInferences;
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

export type TransferChanceInput = {
	transferTo: string;
}