import { LoggerFactory } from "@common/core";
import type { CardsData } from "@literature/data";
import { IQuery, IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { DatabaseService } from "../services";
import { transformCardsData } from "../utils";

export class CardsDataQuery implements IQuery {
	constructor(
		public readonly gameId: string,
		public readonly playerId?: string
	) {}
}

@QueryHandler( CardsDataQuery )
export class CardsDataQueryHandler implements IQueryHandler<CardsDataQuery, CardsData> {

	private readonly logger = LoggerFactory.getLogger( CardsDataQueryHandler );

	constructor( private readonly db: DatabaseService ) {}

	async execute( { gameId, playerId }: CardsDataQuery ) {
		this.logger.debug( ">> getCardsData()" );

		const cardMappings = !!playerId
			? await this.db.getCardMappingsForPlayer( gameId, playerId )
			: await this.db.getCardMappingsForGame( gameId );

		const cardsData = transformCardsData( cardMappings );

		this.logger.debug( "<< getCardsData()" );
		return cardsData;
	};
}