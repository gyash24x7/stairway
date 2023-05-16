import { CardSet, IPlayingCard, PlayingCard } from "@s2h/cards";

export type LiteratureMoveAction = "ASK" | "CALL" | "CHANCE_TRANSFER";

export type AskActionData = {
	from: string;
	by: string;
	card: IPlayingCard
}

export type CallActionData = {
	set: CardSet
}

export type ChanceTransferData = {
	playerId: string;
}

export type LiteratureMoveActionData = {
	action: LiteratureMoveAction;
	askData?: AskActionData;
	callData?: CallActionData;
	transferData?: ChanceTransferData;
}

export type LiteratureMoveResult = "CARD_TRANSFER" | "CALL_SET";

export type CardTransferResultData = {
	success: boolean;
	by: string;
	to: string;
	card: PlayingCard;
};

export type CallSetResultData = {
	success: boolean;
	set: CardSet;
}

export type LiteratureMoveResultData = {
	result: LiteratureMoveResult;
	cardTransferData?: CardTransferResultData;
	callSetData?: CallSetResultData;
}

export interface ILiteratureMove {
	id: string;
	description: string;
	gameId: string;
	timestamp: string;
	action: LiteratureMoveActionData;
	result: LiteratureMoveResultData;
}

export class LiteratureMove implements ILiteratureMove {
	id: string;
	description: string;
	action: LiteratureMoveActionData;
	gameId: string;
	result: LiteratureMoveResultData;
	timestamp: string;
}