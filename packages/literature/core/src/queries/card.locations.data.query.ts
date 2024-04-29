import { LoggerFactory } from "@common/core";
import type { CardLocationsData } from "@literature/data";
import { type IQuery, type IQueryHandler, QueryHandler } from "@nestjs/cqrs";
import { DatabaseService } from "../services";
import { transformCardLocationsData } from "../utils";

export class CardLocationsDataQuery implements IQuery {
	constructor(
		public readonly gameId: string,
		public readonly playerId?: string
	) {}
}

@QueryHandler( CardLocationsDataQuery )
export class CardLocationsDataQueryHandler implements IQueryHandler<CardLocationsDataQuery, CardLocationsData> {

	private readonly logger = LoggerFactory.getLogger( CardLocationsDataQueryHandler );

	constructor( private readonly db: DatabaseService ) {}

	async execute( { gameId, playerId }: CardLocationsDataQuery ) {
		this.logger.debug( ">> getCardLocationsData()" );

		const cardLocations = !playerId
			? await this.db.getCardLocationsForGame( gameId )
			: await this.db.getCardLocationsForPlayer( gameId, playerId );

		this.logger.debug( "<< getCardLocationsData()" );
		return transformCardLocationsData( cardLocations );
	};
}