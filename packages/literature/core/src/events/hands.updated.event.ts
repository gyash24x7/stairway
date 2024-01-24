import { LoggerFactory } from "@common/core";
import type { HandData } from "@literature/data";
import { EventsHandler, type IEvent, IEventHandler } from "@nestjs/cqrs";
import { GameEvents, LiteratureGateway } from "../utils";

export class HandsUpdatedEvent implements IEvent {
	constructor(
		public readonly gameId: string,
		public readonly hands: HandData
	) {}
}

@EventsHandler( HandsUpdatedEvent )
export class HandsUpdatedEventHandler implements IEventHandler<HandsUpdatedEvent> {

	private readonly logger = LoggerFactory.getLogger( HandsUpdatedEventHandler );

	constructor( private readonly gateway: LiteratureGateway ) {}

	async handle( { gameId, hands }: HandsUpdatedEvent ) {
		this.logger.debug( ">> handleHandsUpdated()" );

		const cardCounts: Record<string, number> = {};
		this.logger.debug( gameId );

		Object.keys( hands ).map( playerId => {
			cardCounts[ playerId ] = hands[ playerId ].length;
			this.gateway.publishPlayerEvent( gameId, playerId, GameEvents.HAND_UPDATED, hands[ playerId ] );
		} );

		this.gateway.publishGameEvent( gameId, GameEvents.CARD_COUNT_UPDATED, cardCounts );

		this.logger.debug( "<< handleHandsUpdated()" );
	}
}