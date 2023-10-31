import type { HandData } from "@literature/types";
import type { IEvent, IEventHandler } from "@nestjs/cqrs";
import { EventsHandler } from "@nestjs/cqrs";
import { LoggerFactory, RealtimeService } from "@s2h/core";
import { Constants, GameEvents } from "../constants";

export class HandsUpdatedEvent implements IEvent {
	constructor(
		public readonly hands: HandData,
		public readonly gameId: string
	) {}
}

@EventsHandler( HandsUpdatedEvent )
export class HandsUpdatedEventHandler implements IEventHandler<HandsUpdatedEvent> {

	private readonly logger = LoggerFactory.getLogger( HandsUpdatedEventHandler );

	constructor( private readonly realtimeService: RealtimeService ) {}

	async handle( { hands, gameId }: HandsUpdatedEvent ) {
		this.logger.debug( ">> handleHandsUpdatedEvent()" );

		const cardCounts: Record<string, number> = {};

		Object.keys( hands ).map( playerId => {
			cardCounts[ playerId ] = hands[ playerId ].length;
			this.realtimeService.publishMemberMessage(
				Constants.LITERATURE,
				gameId,
				playerId,
				GameEvents.HAND_UPDATED,
				hands[ playerId ]
			);
		} );

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			gameId,
			GameEvents.CARD_COUNT_UPDATED,
			cardCounts
		);

		this.logger.debug( "<< handleHandsUpdatedEvent()" );
	}
}