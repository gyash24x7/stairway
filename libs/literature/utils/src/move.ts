import { CardSet, IPlayingCard } from "@s2h/cards";
import { createId } from "@paralleldrive/cuid2";
import dayjs from "dayjs";

export type LiteratureMoveAction = "ASK" | "CALL_SET" | "CHANCE_TRANSFER";

export type AskActionData = {
	from: string;
	by: string;
	card: IPlayingCard
}

export type CallActionData = {
	playerId: string;
	set: CardSet;
	data: Record<string, Array<IPlayingCard>>
}

export type ChanceTransferData = {
	playerId: string;
}

export type LiteratureMoveActionData = {
	action: LiteratureMoveAction;
	description: string;
	askData?: AskActionData;
	callData?: CallActionData;
	transferData?: ChanceTransferData;
}

export type LiteratureMoveResult = "CARD_TRANSFER" | "CALL_SET" | "CHANCE_TRANSFER";

export type LiteratureMoveResultData = {
	result: LiteratureMoveResult;
	description: string;
	success: boolean;
}

export interface ILiteratureMove {
	id: string;
	description: string;
	timestamp: string;
	actionData: LiteratureMoveActionData;
	resultData: LiteratureMoveResultData;
}

export class LiteratureMove implements ILiteratureMove {
	id: string;
	description: string;
	actionData: LiteratureMoveActionData;
	resultData: LiteratureMoveResultData;
	timestamp: string;

	private constructor( move: ILiteratureMove ) {
		this.id = move.id;
		this.actionData = move.actionData;
		this.resultData = move.resultData;
		this.timestamp = move.timestamp;
		this.description = move.description;
	}

	static from( move: ILiteratureMove ) {
		return new LiteratureMove( move );
	}

	static create( actionData: LiteratureMoveActionData, resultData: LiteratureMoveResultData ) {
		return this.from( {
			actionData,
			resultData,
			id: createId(),
			timestamp: dayjs().toISOString(),
			description: `${ actionData.description } -> ${ resultData.description }`
		} );
	}

	serialize(): ILiteratureMove {
		return JSON.parse( JSON.stringify( this ) );
	}
}