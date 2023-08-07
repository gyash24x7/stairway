import type { IPlayingCard } from "@s2h/cards";

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
	askedFor: IPlayingCard;
}

export type CallSetInput = {
	data: { [ key: string ]: IPlayingCard[] };
}

export type TransferChanceInput = {
	transferTo: string;
}

export interface ILiteraturePlayer {
	id: string;
	name: string;
	avatar: string;
	teamId: string;
}

export interface ILiteratureTeam {
	id: string;
	name: string;
	members: string[];
	score: number;
}

export enum LiteratureGameStatus {
	CREATED = "CREATED",
	PLAYERS_READY = "PLAYERS_READY",
	TEAMS_CREATED = "TEAMS_CREATED",
	IN_PROGRESS = "IN_PROGRESS",
	COMPLETED = "COMPLETED"
}

export interface ILiteratureGame {
	code: string;
	playerCount: number;
	createdBy: string;
	status: LiteratureGameStatus;
	currentTurn: string;
	playerMap: Record<string, ILiteraturePlayer>;
	teamMap: Record<string, ILiteratureTeam>;
}

