export interface ILiteraturePlayer {
	id: string;
	name: string;
	avatar: string;
	teamId?: string;
}

export class LiteraturePlayer implements ILiteraturePlayer {
	readonly id: string;
	readonly name: string;
	readonly avatar: string;
	teamId?: string;

	private constructor( { name, avatar, teamId, id }: ILiteraturePlayer ) {
		this.name = name;
		this.id = id;
		this.avatar = avatar;
		this.teamId = teamId;
	}

	static from( data: ILiteraturePlayer ) {
		return new LiteraturePlayer( data );
	}

	static createFromAuthInfo( { id, name, avatar }: { id: string; name: string; avatar: string } ) {
		return new LiteraturePlayer( { id, name, avatar } );
	}

	serialize(): ILiteraturePlayer {
		const { id, name, avatar, teamId } = this;
		return { id, name, avatar, teamId };
	}
}