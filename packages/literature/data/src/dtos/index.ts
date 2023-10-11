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

export type RawGameData = Game & { players: Player[], teams: Team[], cardMappings: CardMapping[], moves: Move[] }

export type CardMappingData = { handMap: Record<string, PlayingCard[]>, cardMappingMap: Record<string, string> };

export type AggregatedGameData = {
	id: string;
	code: string;
	status: LiteratureGameStatus;
	playerCount: number;
	currentTurn: string;
	players: Record<string, Player>;
	teams: Record<string, Team>;
	cardMappings: Record<string, string>;
	playerList: Player[];
	teamList: Team[];
	moves: Move[];
	hands: Record<string, PlayingCard[]>;
}

export type PlayerSpecificGameData = {
	id: string;
	code: string;
	status: LiteratureGameStatus;
	playerCount: number;
	currentTurn: string;
	players: Record<string, Player>;
	myTeam?: Team & { members: string[] };
	oppositeTeam?: Team & { members: string[] };
	hand: PlayingCard[];
	cardCounts: Record<string, number>;
	moves: Move[];
}

export type GameIdResponse = {
	id: string;
}