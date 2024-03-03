import { LoggerFactory } from "@common/core";
import { EventsHandler, type IEvent, IEventHandler } from "@nestjs/cqrs";
import { GatewayService } from "../services";
import { GameEvents } from "../utils";

export class GameCompletedEvent implements IEvent {
	constructor( public readonly gameId: string ) {}
}

@EventsHandler( GameCompletedEvent )
export class GameCompletedEventHandler implements IEventHandler<GameCompletedEvent> {

	private readonly logger = LoggerFactory.getLogger( GameCompletedEventHandler );

	constructor( private readonly gateway: GatewayService ) {}

	async handle( { gameId }: GameCompletedEvent ) {
		this.logger.debug( ">> handleGameCompletedEvent()" );

		// Publish Completed Event

		this.gateway.publishGameEvent( gameId, GameEvents.GAME_COMPLETED, gameId );

		// Publish Metrics and Performance Stats

		this.logger.debug( "<< handleGameCompletedEvent()" );
	}
}