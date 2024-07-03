import { LoggerFactory } from "@backend/utils";
import { EventsHandler, type IEvent, type IEventHandler } from "@nestjs/cqrs";
import { GameEvents } from "../literature.constants.ts";
import { LiteratureGateway } from "../literature.gateway.ts";
import type { CardLocationsData } from "../literature.types.ts";

export class CardLocationsUpdatedEvent implements IEvent {
	constructor(
		public readonly gameId: string,
		public readonly cardLocationsData: CardLocationsData
	) {}
}

@EventsHandler( CardLocationsUpdatedEvent )
export class CardLocationsUpdatedEventHandler implements IEventHandler<CardLocationsUpdatedEvent> {

	private readonly logger = LoggerFactory.getLogger( CardLocationsUpdatedEventHandler );

	constructor( private readonly gateway: LiteratureGateway ) {}

	async handle( { gameId, cardLocationsData }: CardLocationsUpdatedEvent ) {
		this.logger.debug( ">> handleCardLocationsUpdated()" );
		this.logger.debug( gameId );

		Object.keys( cardLocationsData ).map( playerId => {
			this.gateway.publishPlayerEvent(
				gameId,
				playerId,
				GameEvents.CARD_LOCATIONS_UPDATED,
				cardLocationsData[ playerId ]
			);
		} );

		this.logger.debug( "<< handleCardLocationsUpdated()" );
	}
}