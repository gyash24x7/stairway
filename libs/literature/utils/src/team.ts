export type ILiteratureTeam = {
	name: string;
	score: number;
	gameId: string;
	members: string[];
}

export class LiteratureTeam implements ILiteratureTeam {
	name: string;
	gameId: string;
	members: string[];
	score: number;

	private constructor( teamData: ILiteratureTeam ) {
		this.gameId = teamData.gameId;
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