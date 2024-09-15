import { EventsHandler, type IEvent, type IEventHandler } from "@nestjs/cqrs";
import { LoggerFactory } from "@shared/api";
import { GameEvents } from "../literature.constants.ts";
import { LiteratureEventPublisher } from "../literature.event.publisher.ts";
import { LiteratureRepository } from "../literature.repository.ts";
import type { TeamData } from "../literature.types.ts";

export class TeamsCreatedEvent implements IEvent {
	constructor(
		public readonly teams: TeamData,
		public readonly gameId: string
	) {}
}

@EventsHandler( TeamsCreatedEvent )
export class TeamsCreatedEventHandler implements IEventHandler<TeamsCreatedEvent> {

	private readonly logger = LoggerFactory.getLogger( TeamsCreatedEventHandler );

	constructor(
		private readonly repository: LiteratureRepository,
		private readonly publisher: LiteratureEventPublisher
	) {}

	async handle( { gameId, teams }: TeamsCreatedEvent ) {
		this.logger.debug( ">> handleTeamsCreatedEvent()" );

		await this.repository.updateGameStatus( gameId, "TEAMS_CREATED" );
		this.publisher.publishGameEvent( gameId, GameEvents.STATUS_UPDATED, "TEAMS_CREATED" );

		this.publisher.publishGameEvent( gameId, GameEvents.TEAMS_CREATED, teams );

		this.logger.debug( "<< handleTeamsCreatedEvent()" );
	}
}