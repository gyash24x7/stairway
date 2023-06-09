import { IPlayingCard } from "@s2h/cards";

export interface IPlayerCallData {
	cards: IPlayingCard[];
}

export class CreateGameInput {
	playerCount: number;
	loggedInPlayerId: string;
}

export class JoinGameInput {
	code: string;
	loggedInPlayerId: string;
}

export class CreateTeamsInput {
	gameId: string;
	loggedInPlayerId: string;
	data: { [ key: string ]: string } = {};
}

export class GetGameInput {
	gameId: string;
	loggedInPlayerId: string;
}

export class StartGameInput {
	gameId: string;
	loggedInPlayerId: string;
}

export class AskCardInput {
	gameId: string;
	loggedInPlayerId: string;
	askedFrom: string;
	askedFor?: IPlayingCard;
}

export class CallSetInput {
	gameId: string;
	loggedInPlayerId: string;
	data: { [ key: string ]: IPlayerCallData } = {};
}

export class ChanceTransferInput {
	gameId: string;
	loggedInPlayerId: string;
	transferTo: string;
}

