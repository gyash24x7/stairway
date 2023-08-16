export interface ICallbreakPlayer {
	id: string;
	name: string;
	avatar: string;
}

export class CallbreakPlayer implements ICallbreakPlayer {
	readonly id: string;
	readonly name: string;
	readonly avatar: string;

	private constructor( { name, avatar, id }: ICallbreakPlayer ) {
		this.name = name;
		this.id = id;
		this.avatar = avatar;
	}

	static from( data: ICallbreakPlayer ) {
		return new CallbreakPlayer( data );
	}

	static createFromAuthInfo( { id, name, avatar }: { id: string; name: string; avatar: string } ) {
		return new CallbreakPlayer( { id, name, avatar } );
	}

	serialize(): ICallbreakPlayer {
		const { id, name, avatar } = this;
		return { id, name, avatar };
	}
}