import { EventsHandler, type IEvent, type IEventHandler } from "@nestjs/cqrs";
import { LoggerFactory } from "@shared/api";
import { GameEvents } from "../literature.constants.ts";
import { LiteratureEventPublisher } from "../literature.event.publisher.ts";
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

	constructor( private readonly publisher: LiteratureEventPublisher ) {}

	async handle( { gameId, hands }: HandsUpdatedEvent ) {
		this.logger.debug( ">> handleHandsUpdated()" );

		const cardCounts: Record<string, number> = {};
		this.logger.debug( gameId );

		Object.keys( hands ).map( playerId => {
			cardCounts[ playerId ] = hands[ playerId ].size;
			this.publisher.publishPlayerEvent(
				gameId,
				playerId,
				GameEvents.HAND_UPDATED,
				hands[ playerId ].serialize()
			);
		} );

		this.publisher.publishGameEvent( gameId, GameEvents.CARD_COUNT_UPDATED, cardCounts );

		this.logger.debug( "<< handleHandsUpdated()" );
	}
}