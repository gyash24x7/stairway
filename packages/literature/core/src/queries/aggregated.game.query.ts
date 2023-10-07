import type { IQuery, IQueryHandler } from "@nestjs/cqrs";
import { QueryHandler } from "@nestjs/cqrs";
import type { AggregatedGameData, Player, Team } from "@literature/data";
import { PrismaService } from "../services";
import { getPlayingCardFromId, PlayingCard } from "@s2h/cards";

export class AggregatedGameQuery implements IQuery {
	constructor( public readonly gameId: string ) {}
}

@QueryHandler( AggregatedGameQuery )
export class AggregatedGameQueryHandler implements IQueryHandler<AggregatedGameQuery, AggregatedGameData> {

	constructor( private readonly prisma: PrismaService ) {}

	async execute( { gameId }: AggregatedGameQuery ): Promise<AggregatedGameData> {
		const data = await this.prisma.game.findUniqueOrThrow( {
			where: { id: gameId },
			include: {
				players: true,
				teams: true,
				cardMappings: true,
				moves: {
					take: 5,
					orderBy: {
						timestamp: "desc"
					}
				}
			}
		} );

		const playerMap: Record<string, Player> = {};
		data.players.forEach( player => {
			playerMap[ player.id ] = player;
		} );

		const teamMap: Record<string, Team> = {};
		data.teams.forEach( team => {
			teamMap[ team.id ] = team;
		} );

		const cardMappingMap: Record<string, string> = {};
		const cardHandMap: Record<string, PlayingCard[]> = {};
		data.cardMappings.forEach( cardMapping => {
			cardMappingMap[ cardMapping.cardId ] = cardMapping.playerId;

			if ( !cardHandMap[ cardMapping.playerId ] ) {
				cardHandMap[ cardMapping.playerId ] = [];
			}

			cardHandMap[ cardMapping.playerId ].push( getPlayingCardFromId( cardMapping.cardId ) );
		} );

		return {
			...data,
			players: playerMap,
			teams: teamMap,
			cardMappings: cardMappingMap,
			playerList: data.players,
			teamList: data.teams,
			hands: cardHandMap
		};
	}
}