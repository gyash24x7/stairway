import type { IEvent, IEventHandler } from "@nestjs/cqrs";
import { EventsHandler } from "@nestjs/cqrs";
import type { InferenceData } from "@literature/types";
import { LoggerFactory, RealtimeService } from "@s2h/core";
import { Constants, GameEvents } from "../constants";

export class InferencesUpdatedEvent implements IEvent {
	constructor(
		public readonly inferences: InferenceData,
		public readonly gameId: string
	) {}
}

@EventsHandler( InferencesUpdatedEvent )
export class InferencesUpdatedEventHandler implements IEventHandler<InferencesUpdatedEvent> {

	private readonly logger = LoggerFactory.getLogger( InferencesUpdatedEventHandler );

	constructor( private readonly realtimeService: RealtimeService ) {}

	handle( { inferences, gameId }: InferencesUpdatedEvent ) {
		this.logger.debug( ">> handleInferencesUpdatedEvent()" );

		Object.keys( inferences ).map( playerId => {
			this.realtimeService.publishDirectMessage(
				Constants.LITERATURE,
				gameId,
				playerId,
				GameEvents.INFERENCES_UPDATED,
				inferences[ playerId ]
			);
		} );

		this.logger.debug( "<< handleInferencesUpdatedEvent()" );
	}
}