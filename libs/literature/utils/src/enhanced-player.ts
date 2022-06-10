import { CardHand, ICardHand } from "@s2h/cards";
import type { LitPlayer } from "@prisma/client";

export interface IEnhancedLitPlayer {
	id: string;
	name: string;
	avatar: string;
	userId: string;
	gameId: string;
	teamId?: string | null;
	hand: ICardHand;
}

export class EnhancedLitPlayer implements IEnhancedLitPlayer {
	readonly id: string
	readonly name: string
	readonly avatar: string
	readonly userId: string
	readonly gameId: string
	teamId?: string | null
	hand: CardHand;

	constructor( player: IEnhancedLitPlayer ) {
		this.id = player.id;
		this.name = player.name;
		this.avatar = player.avatar;
		this.userId = player.userId;
		this.gameId = player.gameId;
		this.teamId = player.teamId;
		this.hand = CardHand.from( player.hand );
	}

	static from( player: LitPlayer ) {
		return new EnhancedLitPlayer( { ...player, hand: CardHand.from( player.hand as unknown as ICardHand ) } );
	}
}