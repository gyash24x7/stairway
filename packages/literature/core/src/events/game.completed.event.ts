import { LoggerFactory } from "@common/core";
import { EventsHandler, type IEvent, IEventHandler } from "@nestjs/cqrs";

export class GameCompletedEvent implements IEvent {
	constructor( public readonly gameId: string
	) {}
}

@EventsHandler( GameCompletedEvent )
export class GameCompletedEventHandler implements IEventHandler<GameCompletedEvent> {

	private readonly logger = LoggerFactory.getLogger( GameCompletedEventHandler );

	constructor() {}

	async handle( {}: GameCompletedEvent ) {
		this.logger.debug( ">> handleGameCompletedEvent()" );

		// Publish Completed Event

		// realtimeService.publishRoomMessage(
		// 	Constants.LITERATURE,
		// 	gameId,
		// 	GameEvents.GAME_COMPLETED,
		// 	game
		// );

		// Publish Metrics and Performance Stats

		this.logger.debug( "<< handleGameCompletedEvent()" );
	}
}