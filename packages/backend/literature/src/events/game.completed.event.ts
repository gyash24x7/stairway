import { LoggerFactory } from "@backend/utils";
import { EventsHandler, type IEvent, type IEventHandler } from "@nestjs/cqrs";
import { GameEvents } from "../literature.constants.ts";
import { LiteratureGateway } from "../literature.gateway.ts";

export class GameCompletedEvent implements IEvent {
	constructor( public readonly gameId: string ) {}
}

@EventsHandler( GameCompletedEvent )
export class GameCompletedEventHandler implements IEventHandler<GameCompletedEvent> {

	private readonly logger = LoggerFactory.getLogger( GameCompletedEventHandler );

	constructor( private readonly gateway: LiteratureGateway ) {}

	async handle( { gameId }: GameCompletedEvent ) {
		this.logger.debug( ">> handleGameCompletedEvent()" );

		// Publish Completed Event

		this.gateway.publishGameEvent( gameId, GameEvents.GAME_COMPLETED, gameId );

		// Publish Metrics and Performance Stats

		this.logger.debug( "<< handleGameCompletedEvent()" );
	}
}