import type { CardMappingData } from "@literature/types";
import type { IQuery, IQueryHandler } from "@nestjs/cqrs";
import { QueryHandler } from "@nestjs/cqrs";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { buildCardMappingData } from "../utils";

export class CardMappingsQuery implements IQuery {
	constructor( public readonly gameId: string ) {}
}

@QueryHandler( CardMappingsQuery )
export class CardMappingsQueryHandler implements IQueryHandler<CardMappingsQuery, CardMappingData> {

	private readonly logger = LoggerFactory.getLogger( CardMappingsQueryHandler );

	constructor( private readonly prisma: PrismaService ) {}

	async execute( { gameId }: CardMappingsQuery ) {
		this.logger.debug( ">> executeCardMappingsQuery()" );

		const cardMappings = await this.prisma.literature.cardMapping.findMany( { where: { gameId } } );
		const cardMappingData = buildCardMappingData( cardMappings );

		this.logger.debug( "<< executeCardMappingsQuery()" );
		return cardMappingData;
	}
}