// addMembers( players: EnhancedLitPlayer[] ) {
// 	this.members = players.filter( player => player.teamId === this.id );
// }


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

	increaseScore() {
		this.score++;
	}
}