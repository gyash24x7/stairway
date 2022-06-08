import { Expose, instanceToPlain, plainToInstance, Type } from "class-transformer";
import { LitMove, LitMoveType, Prisma } from "@prisma/client";
import { CardSet, PlayingCard } from "@s2h/cards";

export class EnhancedLitMove {
	@Expose() readonly id: string;
	@Expose() readonly type: LitMoveType;
	@Expose() readonly description: string;
	@Expose() readonly turnId: string | null;
	@Expose() readonly askedFromId: string | null;
	@Expose() readonly askedById: string | null;
	@Expose() readonly gameId: string;
	@Expose() readonly createdAt: Date;

	@Expose() readonly callingSet: CardSet | null;

	@Type( () => PlayingCard )
	@Expose() askedFor: PlayingCard | null;

	constructor( move: LitMove ) {
		this.id = move.id;
		this.type = move.type;
		this.description = move.description;
		this.turnId = move.turnId;
		this.askedById = move.askedById;
		this.askedFromId = move.askedFromId;
		this.gameId = move.gameId;
		this.createdAt = move.createdAt;

		this.callingSet = move.callingSet as CardSet | null;
		this.askedFor = !!move.askedFor ? PlayingCard.from( move.askedFor as Prisma.JsonObject ) : null;
	}

	static from( enhancedLitMove: Record<string, any> ) {
		return plainToInstance( EnhancedLitMove, enhancedLitMove );
	}

	static compareFn( a: LitMove, b: LitMove ) {
		return b.createdAt.getTime() - a.createdAt.getTime();
	}

	serialize() {
		return instanceToPlain( this );
	}
}