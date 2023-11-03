import type { GameData, HandData } from "@literature/types";
import type { IEvent, IEventHandler } from "@nestjs/cqrs";
import { EventsHandler } from "@nestjs/cqrs";
import { LoggerFactory, RealtimeService } from "@s2h/core";
import { Constants, GameEvents } from "../constants";

export class HandsUpdatedEvent implements IEvent {
	constructor(
		public readonly gameData: GameData,
		public readonly hands: HandData
	) {}
}

@EventsHandler( HandsUpdatedEvent )
export class HandsUpdatedEventHandler implements IEventHandler<HandsUpdatedEvent> {

	private readonly logger = LoggerFactory.getLogger( HandsUpdatedEventHandler );

	constructor( private readonly realtimeService: RealtimeService ) {}

	async handle( { hands, gameData }: HandsUpdatedEvent ) {
		this.logger.debug( ">> handleHandsUpdatedEvent()" );

		const cardCounts: Record<string, number> = {};

		Object.keys( hands ).map( playerId => {
			cardCounts[ playerId ] = hands[ playerId ].length;
			this.realtimeService.publishMemberMessage(
				Constants.LITERATURE,
				gameData.id,
				playerId,
				GameEvents.HAND_UPDATED,
				hands[ playerId ]
			);
		} );

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			gameData.id,
			GameEvents.CARD_COUNT_UPDATED,
			cardCounts
		);

		this.logger.debug( "<< handleHandsUpdatedEvent()" );
	}
}