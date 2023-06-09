import { CardSet, IPlayingCard } from "@s2h/cards";
import { createId } from "@paralleldrive/cuid2";
import dayjs from "dayjs";

export enum LiteratureMoveType {
	ASK_CARD = "ASK_CARD",
	CALL_SET = "CALL_SET",
	CHANCE_TRANSFER = "CHANCE_TRANSFER"
}

export interface PlayerCallData {
	cards: Array<IPlayingCard>;
}

export interface AskActionData {
	from: string;
	by: string;
	card: IPlayingCard;
}

export interface CallActionData {
	by: string;
	set: CardSet;
	data: Record<string, PlayerCallData>;
}

export interface TransferActionData {
	from: string;
	to: string;
}

export interface ILiteratureMove<T extends LiteratureMoveType> {
	id: string;
	timestamp: string;
	moveType: T;
	gameId: string;

	action: T extends LiteratureMoveType.ASK_CARD
		? { askData: AskActionData }
		: T extends LiteratureMoveType.CALL_SET
			? { callData: CallActionData }
			: { transferData: TransferActionData };

	success: boolean;
	correctCall: Record<string, PlayerCallData>;
}

export type LiteratureMoveAction<T extends LiteratureMoveType> = T extends LiteratureMoveType.ASK_CARD
	? { askData: AskActionData }
	: ( T extends LiteratureMoveType.CALL_SET
		? { callData: CallActionData }
		: { transferData: TransferActionData } );

export class LiteratureMove<T extends LiteratureMoveType> implements ILiteratureMove<T> {
	id: string;
	timestamp: string;
	moveType: T;
	gameId: string;
	action: LiteratureMoveAction<T>;
	correctCall: Record<string, PlayerCallData> = {};
	success: boolean;

	private constructor( move: ILiteratureMove<T> ) {
		this.id = move.id;
		this.timestamp = move.timestamp;
		this.moveType = move.moveType;
		this.gameId = move.gameId;
		this.action = move.action;
		this.success = move.success;
		this.correctCall = move.correctCall ?? {};
	}

	static from<T extends LiteratureMoveType>( move: ILiteratureMove<T> ) {
		return new LiteratureMove<T>( move );
	}

	static createAskMove( gameId: string, askData: AskActionData, success: boolean ) {
		return LiteratureMove.create<LiteratureMoveType.ASK_CARD>(
			gameId,
			LiteratureMoveType.ASK_CARD,
			{ askData },
			success
		);
	}

	static createCallMove(
		gameId: string,
		callData: CallActionData,
		success: boolean,
		correctCall: Record<string, PlayerCallData>
	) {
		return LiteratureMove.create<LiteratureMoveType.CALL_SET>(
			gameId,
			LiteratureMoveType.CALL_SET,
			{ callData },
			success,
			correctCall
		);
	}

	static createChanceTransferMove( gameId: string, transferData: TransferActionData ) {
		return LiteratureMove.create<LiteratureMoveType.CHANCE_TRANSFER>(
			gameId,
			LiteratureMoveType.CHANCE_TRANSFER,
			{ transferData },
			true
		);
	}

	static create<T extends LiteratureMoveType>(
		gameId: string,
		moveType: T,
		action: LiteratureMoveAction<T>,
		success: boolean,
		correctCall: Record<string, PlayerCallData> = {}
	) {
		return this.from( {
			gameId,
			action,
			success,
			id: createId(),
			timestamp: dayjs().toISOString(),
			correctCall,
			moveType
		} );
	}

	serialize(): ILiteratureMove<T> {
		return JSON.parse( JSON.stringify( this ) );
	}
}