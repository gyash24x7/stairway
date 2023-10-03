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

