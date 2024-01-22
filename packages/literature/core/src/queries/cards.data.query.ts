import { LoggerFactory } from "@common/core";
import type { CardsData } from "@literature/data";
import { IQuery, IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { LiteratureService, LiteratureTransformers } from "../utils";

export class CardsDataQuery implements IQuery {
	constructor(
		public readonly gameId: string,
		public readonly playerId?: string
	) {}
}

@QueryHandler( CardsDataQuery )
export class CardsDataQueryHandler implements IQueryHandler<CardsDataQuery, CardsData> {

	private readonly logger = LoggerFactory.getLogger( CardsDataQueryHandler );

	constructor(
		private readonly service: LiteratureService,
		private readonly transformers: LiteratureTransformers
	) {}

	async execute( { gameId, playerId }: CardsDataQuery ) {
		this.logger.debug( ">> getCardsData()" );

		const cardMappings = !!playerId
			? await this.service.getCardMappingsForPlayer( gameId, playerId )
			: await this.service.getCardMappingsForGame( gameId );

		const cardsData = this.transformers.transformCardsData( cardMappings );

		this.logger.debug( "<< getCardsData()" );
		return cardsData;
	};
}