import { Expose, instanceToPlain, plainToInstance, Type } from "class-transformer";
import { CardHand } from "@s2h/cards";
import type { LitPlayer, Prisma } from "@prisma/client";

export class EnhancedLitPlayer {
	@Expose() readonly id: string
	@Expose() readonly name: string
	@Expose() readonly avatar: string
	@Expose() readonly userId: string
	@Expose() readonly gameId: string

	@Expose() teamId: string | null

	@Type( () => CardHand )
	@Expose() hand: CardHand;

	constructor( player: LitPlayer ) {
		this.id = player.id;
		this.name = player.name;
		this.avatar = player.avatar;
		this.userId = player.userId;
		this.teamId = player.teamId;
		this.gameId = player.gameId;

		this.hand = CardHand.from( player.hand as Prisma.JsonObject );
	}

	static from( enhancedLitPlayer: Record<string, any> ) {
		return plainToInstance( EnhancedLitPlayer, enhancedLitPlayer );
	}

	serialize() {
		return instanceToPlain( this );
	}
}