import type { LitMove, LitMoveType } from "@prisma/client";
import { IPlayingCard, PlayingCard } from "@s2h/cards";

export interface IEnhancedLitMove {
	id: string;
	type: LitMoveType;
	description: string;
	turnId: string | null;
	askedFromId: string | null;
	askedById: string | null;
	gameId: string;
	createdAt: Date;
	askedFor: PlayingCard | null;
}

export class EnhancedLitMove implements IEnhancedLitMove {
	readonly id: string;
	readonly type: LitMoveType;
	readonly description: string;
	readonly turnId: string | null;
	readonly askedFromId: string | null;
	readonly askedById: string | null;
	readonly gameId: string;
	readonly createdAt: Date;

	readonly askedFor: PlayingCard | null;

	constructor( move: IEnhancedLitMove ) {
		this.id = move.id;
		this.type = move.type;
		this.description = move.description;
		this.turnId = move.turnId;
		this.askedFromId = move.askedFromId;
		this.askedById = move.askedById;
		this.gameId = move.gameId;
		this.createdAt = move.createdAt;
		this.askedFor = move.askedFor;
	}

	static from( move: LitMove ) {
		return new EnhancedLitMove( {
			...move,
			askedFor: !!move.askedFor ? PlayingCard.from( move.askedFor as unknown as IPlayingCard ) : null
		} );
	}
}