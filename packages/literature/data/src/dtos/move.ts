import { CardSet, IPlayingCard, PlayingCard } from "@s2h/cards";

export interface IAskMoveData {
	from: string;
	by: string;
	card: IPlayingCard;
}

export class AskMoveData implements IAskMoveData {
	by: string;
	card: PlayingCard;
	from: string;

	constructor( { by, card, from }: IAskMoveData ) {
		this.by = by;
		this.card = PlayingCard.from( card );
		this.from = from;
	}
}

export interface ICallMoveData {
	by: string;
	cardSet: CardSet;
	actualCall: Record<string, IPlayingCard[]>;
	correctCall: Record<string, IPlayingCard[]>;
}

export class CallMoveData implements ICallMoveData {
	by: string;
	cardSet: CardSet;
	actualCall: Record<string, PlayingCard[]>;
	correctCall: Record<string, PlayingCard[]>;

	constructor( { by, correctCall, actualCall, cardSet }: ICallMoveData ) {
		this.by = by;
		this.cardSet = cardSet;

		this.actualCall = {};
		Object.keys( actualCall ).map( playerId => {
			actualCall[ playerId ] = actualCall[ playerId ].map( PlayingCard.from );
		} );

		this.correctCall = {};
		Object.keys( correctCall ).map( playerId => {
			correctCall[ playerId ] = correctCall[ playerId ].map( PlayingCard.from );
		} );
	}
}

export interface ITransferMoveData {
	from: string;
	to: string;
}

export class TransferMoveData implements ITransferMoveData {
	from: string;
	to: string;

	constructor( { from, to }: ITransferMoveData ) {
		this.from = from;
		this.to = to;
	}
}

export enum LiteratureMoveType {
	ASK_CARD = "ASK_CARD",
	CALL_SET = "CALL_SET",
	TRANSFER_CHANCE = "TRANSFER_CHANCE"
}

export interface ILiteratureMove {
	timestamp: Date;
	success: boolean;
	gameId: string;
	type: LiteratureMoveType;

	askData?: IAskMoveData;
	callData?: ICallMoveData;
	transferData?: ITransferMoveData;
}

export class LiteratureMove implements ILiteratureMove {
	readonly id: string;
	readonly timestamp: Date;
	readonly gameId: string;
	readonly success: boolean;
	readonly type: LiteratureMoveType;

	readonly askData?: AskMoveData;
	readonly callData?: CallMoveData;
	readonly transferData?: TransferMoveData;

	private constructor( data: ILiteratureMove & { id: string } ) {
		this.id = data.id;
		this.timestamp = data.timestamp;
		this.gameId = data.gameId;
		this.success = data.success;
		this.type = data.type;

		this.callData = !!data.callData ? new CallMoveData( data.callData ) : undefined;
		this.askData = !!data.askData ? new AskMoveData( data.askData ) : undefined;
		this.transferData = !!data.transferData ? new TransferMoveData( data.transferData ) : undefined;
	}

	static buildAskMove( id: string, gameId: string, askData: AskMoveData, success: boolean ) {
		return new LiteratureMove( {
			id,
			gameId,
			success,
			type: LiteratureMoveType.ASK_CARD,
			askData,
			timestamp: new Date()
		} );
	}

	static buildCallMove( id: string, gameId: string, callData: CallMoveData, success: boolean ) {
		return new LiteratureMove( {
			id,
			gameId,
			success,
			type: LiteratureMoveType.CALL_SET,
			callData,
			timestamp: new Date()
		} );
	}

	static buildTransferMove( id: string, gameId: string, transferData: TransferMoveData ) {
		return new LiteratureMove( {
			id,
			gameId,
			success: true,
			type: LiteratureMoveType.TRANSFER_CHANCE,
			transferData,
			timestamp: new Date()
		} );
	}

	serialize(): ILiteratureMove {
		const { timestamp, type, askData, callData, transferData, gameId, success } = this;
		return { timestamp, type, askData, callData, transferData, gameId, success };
	}
}