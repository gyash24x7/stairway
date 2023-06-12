import { UserAuthInfo } from "@s2h/auth";

export interface ILiteraturePlayer {
	id: string;
	name: string;
	avatar: string;
	teamId?: string;
}

export class LiteraturePlayer implements ILiteraturePlayer {
	id: string;
	name: string;
	avatar: string;
	teamId?: string;

	private constructor( playerData: ILiteraturePlayer ) {
		this.id = playerData.id;
		this.name = playerData.name;
		this.avatar = playerData.avatar;
		this.teamId = playerData.teamId;
	}

	get callableCardSets() {
		// return this.hand.cardSetsInHand.filter( cardSet => this.hand.getCardsOfSet( cardSet ).length <= 6 );
		return [];
	}

	get askableCardSets() {
		// return this.hand.cardSetsInHand.filter( cardSet => this.hand!.getCardsOfSet( cardSet ).length < 6 );
		return [];
	}

	static from( playerData: ILiteraturePlayer ) {
		return new LiteraturePlayer( playerData );
	}

	static create( { id, name, avatar }: UserAuthInfo ) {
		return new LiteraturePlayer( { id, name, avatar } );
	}

	serialize(): ILiteraturePlayer {
		return JSON.parse( JSON.stringify( this ) );
	}
}