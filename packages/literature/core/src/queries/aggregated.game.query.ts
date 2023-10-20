import type { IQuery, IQueryHandler } from "@nestjs/cqrs";
import { QueryHandler } from "@nestjs/cqrs";
import type { AggregatedGameData } from "@literature/data";
import { buildAggregatedGameData } from "../utils";
import { PrismaService } from "@s2h/core";

export class AggregatedGameQuery implements IQuery {
	constructor( public readonly gameId: string ) {}
}

@QueryHandler( AggregatedGameQuery )
export class AggregatedGameQueryHandler implements IQueryHandler<AggregatedGameQuery, AggregatedGameData> {

	constructor( private readonly prisma: PrismaService ) {}

	async execute( { gameId }: AggregatedGameQuery ): Promise<AggregatedGameData> {
		const data = await this.prisma.literature.game.findUniqueOrThrow( {
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

		return buildAggregatedGameData( data );
	}
}