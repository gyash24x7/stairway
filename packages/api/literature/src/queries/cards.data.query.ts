import { type IQuery, type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { LoggerFactory } from "@shared/api";
import { CardHand } from "@stairway/cards";
import { LiteratureRepository } from "../literature.repository.ts";
import type { CardMapping, CardMappingData, CardsData, HandData } from "../literature.types.ts";

export class CardsDataQuery implements IQuery {
	constructor(
		public readonly gameId: string,
		public readonly playerId?: string
	) {}
}

@QueryHandler( CardsDataQuery )
export class CardsDataQueryHandler implements IQueryHandler<CardsDataQuery, CardsData> {

	private readonly logger = LoggerFactory.getLogger( CardsDataQueryHandler );

	constructor( private readonly repository: LiteratureRepository ) {}

	async execute( { gameId, playerId }: CardsDataQuery ) {
		this.logger.debug( ">> getCardsData()" );

		const cardMappings = !!playerId
			? await this.repository.getCardMappingsForPlayer( gameId, playerId )
			: await this.repository.getCardMappingsForGame( gameId );

		const cardsData = this.transformCardsData( cardMappings );

		this.logger.debug( "<< getCardsData()" );
		return cardsData;
	};

	private transformCardsData( cardMappings: CardMapping[] ): CardsData {
		const mappings: CardMappingData = {};
		const hands: HandData = {};

		cardMappings.forEach( cardMapping => {
			if ( !hands[ cardMapping.playerId ] ) {
				hands[ cardMapping.playerId ] = CardHand.from( [] );
			}

			hands[ cardMapping.playerId ].addCard( cardMapping.cardId );
			mappings[ cardMapping.cardId ] = cardMapping.playerId;
		} );

		return { mappings, hands };
	}

}