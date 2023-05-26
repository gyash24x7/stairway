import { CardHand, ICardHand } from "@s2h/cards";
import { IUser } from "@s2h/utils";

export interface ILiteraturePlayer {
	id: string;
	name: string;
	avatar: string;
	team?: string;
	hand: ICardHand;
}

export class LiteraturePlayer implements ILiteraturePlayer {
	id: string;
	name: string;
	avatar: string;
	team?: string;
	hand: CardHand;

	private constructor( playerData: ILiteraturePlayer ) {
		this.id = playerData.id;
		this.name = playerData.name;
		this.avatar = playerData.avatar;
		this.team = playerData.team;
		this.hand = CardHand.from( playerData.hand );
	}

	get callableCardSets() {
		return this.hand.cardSetsInHand.filter( cardSet => this.hand.getCardsOfSet( cardSet ).length <= 6 );
	}

	get askableCardSets() {
		return this.hand.cardSetsInHand.filter( cardSet => this.hand!.getCardsOfSet( cardSet ).length < 6 );
	}

	static from( playerData: ILiteraturePlayer ) {
		return new LiteraturePlayer( playerData );
	}

	static create( user: IUser ) {
		return new LiteraturePlayer( {
			id: user.id,
			name: user.name,
			avatar: user.avatar,
			hand: CardHand.empty()
		} );
	}

	serialize(): ILiteraturePlayer {
		return JSON.parse( JSON.stringify( this ) );
	}
}