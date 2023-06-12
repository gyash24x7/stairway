export interface ILiteratureTeam {
	id: string;
	name: string;
	score: number;
	members: Array<string>;
}

export class LiteratureTeam implements ILiteratureTeam {
	id: string;
	name: string;
	members: string[];
	score: number;

	private constructor( teamData: ILiteratureTeam ) {
		this.id = teamData.id;
		this.name = teamData.name;
		this.members = teamData.members;
		this.score = teamData.score;
	}

	static from( teamData: ILiteratureTeam ) {
		return new LiteratureTeam( teamData );
	}

	serialize(): ILiteratureTeam {
		return JSON.parse( JSON.stringify( this ) );
	}
}