import { EventsHandler, type IEvent, type IEventHandler } from "@nestjs/cqrs";
import { LoggerFactory } from "@shared/api";
import { GameEvents } from "../literature.constants.ts";
import { LiteratureEventPublisher } from "../literature.event.publisher.ts";

export class GameCompletedEvent implements IEvent {
	constructor( public readonly gameId: string ) {}
}

@EventsHandler( GameCompletedEvent )
export class GameCompletedEventHandler implements IEventHandler<GameCompletedEvent> {

	private readonly logger = LoggerFactory.getLogger( GameCompletedEventHandler );

	constructor( private readonly publisher: LiteratureEventPublisher ) {}

	async handle( { gameId }: GameCompletedEvent ) {
		this.logger.debug( ">> handleGameCompletedEvent()" );

		// Publish Completed Event

		this.publisher.publishGameEvent( gameId, GameEvents.GAME_COMPLETED, gameId );

		// Publish Metrics and Performance Stats

		this.logger.debug( "<< handleGameCompletedEvent()" );
	}
}