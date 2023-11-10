import type { GameData } from "@literature/types";
import type { IQuery, IQueryHandler } from "@nestjs/cqrs";
import { QueryHandler } from "@nestjs/cqrs";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { GameDataTransformer } from "../transformers";

export class GameDataQuery implements IQuery {
	constructor( public readonly gameId: string ) {}
}

@QueryHandler( GameDataQuery )
export class GameDataQueryHandler implements IQueryHandler<GameDataQuery, GameData> {

	private readonly logger = LoggerFactory.getLogger( GameDataQueryHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly transformer: GameDataTransformer
	) {}

	async execute( { gameId }: GameDataQuery ) {
		this.logger.debug( ">> executeGameDataQuery()" );

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

		this.logger.debug( "<< executeGameDataQuery()" );
		return this.transformer.transform( data );
	}
}