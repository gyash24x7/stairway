import type { LitTeam } from "@prisma/client";
import { EnhancedLitPlayer, IEnhancedLitPlayer } from "./enhanced-player";

export interface IEnhancedLitTeam {
	id: string;
	name: string;
	score: number;
	gameId: string;
	members: IEnhancedLitPlayer[]
}


export class EnhancedLitTeam implements IEnhancedLitTeam {
	readonly id: string;
	readonly name: string;
	readonly score: number;
	readonly gameId: string;

	members: EnhancedLitPlayer[];

	constructor( team: IEnhancedLitTeam ) {
		this.id = team.id;
		this.name = team.name;
		this.score = team.score;
		this.gameId = team.gameId;
		this.members = team.members.map( member => new EnhancedLitPlayer( member ) );
	}

	get membersWithCards() {
		return this.members.filter( member => member.hand.length > 0 );
	}

	static from( litTeam: LitTeam ) {
		return new EnhancedLitTeam( { ...litTeam, members: [] } );
	}

	addMembers( players: EnhancedLitPlayer[] ) {
		this.members = players.filter( player => player.teamId === this.id );
	}
}