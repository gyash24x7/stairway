import type { GameStatus } from "@literature/types";
import type { IEvent, IEventHandler } from "@nestjs/cqrs";
import { EventsHandler } from "@nestjs/cqrs";
import { LoggerFactory, RealtimeService } from "@s2h/core";
import { Constants, GameEvents } from "../constants";

export class StatusUpdatedEvent implements IEvent {
	constructor(
		public readonly gameId: string,
		public readonly status: GameStatus
	) {}
}

@EventsHandler( StatusUpdatedEvent )
export class StatusUpdatedEventHandler implements IEventHandler<StatusUpdatedEvent> {

	private readonly logger = LoggerFactory.getLogger( StatusUpdatedEventHandler );

	constructor( private readonly realtimeService: RealtimeService ) {}

	async handle( { gameId, status }: StatusUpdatedEvent ) {
		this.logger.debug( ">> handleStatusUpdatedEvent()" );

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			gameId,
			GameEvents.STATUS_UPDATED,
			status
		);

		this.logger.debug( "<< handleStatusUpdatedEvent()" );
	}
}