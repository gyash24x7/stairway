import type { GameData } from "@literature/types";
import type { IEvent, IEventHandler } from "@nestjs/cqrs";
import { EventsHandler } from "@nestjs/cqrs";
import { LoggerFactory, RealtimeService } from "@s2h/core";
import { Constants, GameEvents } from "../constants";

export class StatusUpdatedEvent implements IEvent {
	constructor( public readonly gameData: GameData ) {}
}

@EventsHandler( StatusUpdatedEvent )
export class StatusUpdatedEventHandler implements IEventHandler<StatusUpdatedEvent> {

	private readonly logger = LoggerFactory.getLogger( StatusUpdatedEventHandler );

	constructor( private readonly realtimeService: RealtimeService ) {}

	async handle( { gameData }: StatusUpdatedEvent ) {
		this.logger.debug( ">> handleStatusUpdatedEvent()" );

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			gameData.id,
			GameEvents.STATUS_UPDATED,
			gameData.status
		);

		this.logger.debug( "<< handleStatusUpdatedEvent()" );
	}
}