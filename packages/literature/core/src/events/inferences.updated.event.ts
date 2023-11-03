import type { GameData, InferenceData } from "@literature/types";
import type { IEvent, IEventHandler } from "@nestjs/cqrs";
import { EventsHandler } from "@nestjs/cqrs";
import { LoggerFactory, RealtimeService } from "@s2h/core";
import { Constants, GameEvents } from "../constants";

export class InferencesUpdatedEvent implements IEvent {
	constructor(
		public readonly gameData: GameData,
		public readonly inferences: InferenceData
	) {}
}

@EventsHandler( InferencesUpdatedEvent )
export class InferencesUpdatedEventHandler implements IEventHandler<InferencesUpdatedEvent> {

	private readonly logger = LoggerFactory.getLogger( InferencesUpdatedEventHandler );

	constructor( private readonly realtimeService: RealtimeService ) {}

	async handle( { inferences, gameData }: InferencesUpdatedEvent ) {
		this.logger.debug( ">> handleInferencesUpdatedEvent()" );

		Object.keys( inferences ).map( playerId => {
			this.realtimeService.publishMemberMessage(
				Constants.LITERATURE,
				gameData.id,
				playerId,
				GameEvents.INFERENCES_UPDATED,
				inferences[ playerId ]
			);
		} );

		this.logger.debug( "<< handleInferencesUpdatedEvent()" );
	}
}