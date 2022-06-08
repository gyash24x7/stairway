import type { LitTeam } from "@prisma/client";
import { Exclude, Expose, instanceToPlain, plainToInstance, Type } from "class-transformer";
import { EnhancedLitPlayer } from "./lit-player";

export class EnhancedLitTeam implements LitTeam {
	@Expose() readonly id: string;
	@Expose() readonly name: string;
	@Expose() readonly score: number;
	@Expose() readonly gameId: string;

	@Type( () => EnhancedLitPlayer )
	@Expose() members: EnhancedLitPlayer[];

	constructor( litTeam: LitTeam, players: EnhancedLitPlayer[] ) {
		this.id = litTeam.id;
		this.name = litTeam.name;
		this.score = litTeam.score;
		this.gameId = litTeam.gameId;

		this.members = players.filter( player => player.teamId === litTeam.id );
	}

	@Exclude()
	get membersWithCards() {
		return this.members.filter( member => member.hand.length > 0 );
	}

	static from( enhancedLitTeam: EnhancedLitTeam ) {
		return plainToInstance( EnhancedLitTeam, enhancedLitTeam );
	}

	serialize() {
		return instanceToPlain( this );
	}
}