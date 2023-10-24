import type { IQuery, IQueryHandler } from "@nestjs/cqrs";
import { QueryHandler } from "@nestjs/cqrs";
import type { CardMappingData, GameData } from "@literature/types";
import { LoggerFactory, PrismaService } from "@s2h/core";

export class CardMappingsQuery implements IQuery {
	constructor( public readonly gameData: GameData ) {}
}

@QueryHandler( CardMappingsQuery )
export class CardMappingsQueryHandler implements IQueryHandler<CardMappingsQuery, CardMappingData> {

	private readonly logger = LoggerFactory.getLogger( CardMappingsQueryHandler );

	constructor( private readonly prisma: PrismaService ) {}

	async execute( { gameData }: CardMappingsQuery ) {
		this.logger.debug( ">> executeCardMappingsQuery()" );

		const cardMappings = await this.prisma.literature.cardMapping.findMany( {
			where: { gameId: gameData.id }
		} );

		const cardMappingData: CardMappingData = {};
		cardMappings.forEach( cardMapping => {
			cardMappingData[ cardMapping.cardId ] = cardMapping.playerId;
		} );

		this.logger.debug( "<< executeCardMappingsQuery()" );
		return cardMappingData;
	}
}