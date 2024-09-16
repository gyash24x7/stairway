import { LoggerFactory } from "@shared/api";
import { type IQuery, type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { LiteratureRepository } from "../literature.repository.ts";
import type { CardLocation, CardLocationsData } from "../literature.types.ts";

export class CardLocationsDataQuery implements IQuery {
	constructor(
		public readonly gameId: string,
		public readonly playerId?: string
	) {}
}

@QueryHandler( CardLocationsDataQuery )
export class CardLocationsDataQueryHandler implements IQueryHandler<CardLocationsDataQuery, CardLocationsData> {

	private readonly logger = LoggerFactory.getLogger( CardLocationsDataQueryHandler );

	constructor( private readonly repository: LiteratureRepository ) {}

	async execute( { gameId, playerId }: CardLocationsDataQuery ) {
		this.logger.debug( ">> getCardLocationsData()" );

		const cardLocations = !playerId
			? await this.repository.getCardLocationsForGame( gameId )
			: await this.repository.getCardLocationsForPlayer( gameId, playerId );

		this.logger.debug( "<< getCardLocationsData()" );
		return this.transformCardLocationsData( cardLocations );
	};

	private transformCardLocationsData( cardLocations: CardLocation[] ) {
		const cardLocationsData: CardLocationsData = {};

		for ( const cardLocation of cardLocations ) {
			if ( !cardLocationsData[ cardLocation.playerId ] ) {
				cardLocationsData[ cardLocation.playerId ] = [];
			}

			cardLocationsData[ cardLocation.playerId ].push( cardLocation );
		}

		return cardLocationsData;
	}
}