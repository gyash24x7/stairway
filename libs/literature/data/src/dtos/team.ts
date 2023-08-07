export interface ILiteratureTeam {
	id: string;
	name: string;
	members: string[];
	score: number;
}

export class LiteratureTeam implements ILiteratureTeam {
	readonly id: string;
	readonly name: string;
	readonly members: string[] = [];
	score: number = 0;

	private constructor( { name, members, id, score }: ILiteratureTeam ) {
		this.name = name;
		this.id = id;
		this.score = score;
		this.members = members;
	}

	static from( data: ILiteratureTeam ) {
		return new LiteratureTeam( data );
	}

	static create( id: string, name: string, members: string[] ) {
		return new LiteratureTeam( { name, score: 0, members, id } );
	}

	serialize(): ILiteratureTeam {
		const { id, name, members, score } = this;
		return { id, name, members, score };
	}
}