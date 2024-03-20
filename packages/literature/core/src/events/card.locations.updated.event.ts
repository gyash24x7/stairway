import { LoggerFactory } from "@common/core";
import type { CardLocationsData } from "@literature/data";
import { EventsHandler, type IEvent, IEventHandler } from "@nestjs/cqrs";
import { GatewayService } from "../services";
import { GameEvents } from "../utils";

export class CardLocationsUpdatedEvent implements IEvent {
	constructor(
		public readonly gameId: string,
		public readonly cardLocationsData: CardLocationsData
	) {}
}

@EventsHandler( CardLocationsUpdatedEvent )
export class CardLocationsUpdatedEventHandler implements IEventHandler<CardLocationsUpdatedEvent> {

	private readonly logger = LoggerFactory.getLogger( CardLocationsUpdatedEventHandler );

	constructor( private readonly gateway: GatewayService ) {}

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