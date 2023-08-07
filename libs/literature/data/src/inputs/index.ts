import type { IPlayingCard } from "@s2h/cards";

export class CreateGameInput {
	playerCount: number;
}

export class JoinGameInput {
	code: string;
}

export class CreateTeamsInput {
	data: { [ key: string ]: string[] } = {};
}

export class AskCardInput {
	askedFrom: string;
	askedFor: IPlayingCard;
}

export class CallSetInput {
	data: { [ key: string ]: IPlayingCard[] } = {};
}

export class TransferChanceInput {
	transferTo: string;
}

