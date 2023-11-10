import type { CardsData } from "@literature/types";
import type { IQuery, IQueryHandler } from "@nestjs/cqrs";
import { QueryHandler } from "@nestjs/cqrs";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { CardsDataTransformer } from "../transformers";

export class CardsDataQuery implements IQuery {
	constructor( public readonly gameId: string ) {}
}

@QueryHandler( CardsDataQuery )
export class CardsDataQueryHandler implements IQueryHandler<CardsDataQuery, CardsData> {

	private readonly logger = LoggerFactory.getLogger( CardsDataQueryHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly transformer: CardsDataTransformer
	) {}

	async execute( { gameId }: CardsDataQuery ) {
		this.logger.debug( ">> executeCardMappingsQuery()" );

		const cardMappings = await this.prisma.literature.cardMapping.findMany( { where: { gameId } } );
		const cardLocationsData = this.transformer.transform( cardMappings );

		this.logger.debug( "<< executeCardMappingsQuery()" );
		return cardLocationsData;
	}
}