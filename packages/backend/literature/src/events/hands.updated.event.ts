import { LoggerFactory } from "@backend/utils";
import { EventsHandler, type IEvent, type IEventHandler } from "@nestjs/cqrs";
import { GameEvents } from "../literature.constants.ts";
import { LiteratureGateway } from "../literature.gateway.ts";
import type { HandData } from "../literature.types.ts";

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
			cardCounts[ playerId ] = hands[ playerId ].cards.length;
			this.gateway.publishPlayerEvent( gameId, playerId, GameEvents.HAND_UPDATED, hands[ playerId ].cards );
		} );

		this.gateway.publishGameEvent( gameId, GameEvents.CARD_COUNT_UPDATED, cardCounts );

		this.logger.debug( "<< handleHandsUpdated()" );
	}
}