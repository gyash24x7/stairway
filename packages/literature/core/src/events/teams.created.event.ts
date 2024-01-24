import { LoggerFactory } from "@common/core";
import type { TeamData } from "@literature/data";
import { EventsHandler, type IEvent, IEventHandler } from "@nestjs/cqrs";
import { GameEvents, LiteratureGateway, LiteratureService } from "../utils";

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
		private readonly service: LiteratureService,
		private readonly gateway: LiteratureGateway
	) {}

	async handle( { gameId, teams }: TeamsCreatedEvent ) {
		this.logger.debug( ">> handleTeamsCreatedEvent()" );

		await this.service.updateGameStatus( gameId, "TEAMS_CREATED" );

		this.gateway.publishGameEvent( gameId, GameEvents.TEAMS_CREATED, teams );

		this.logger.debug( "<< handleTeamsCreatedEvent()" );
	}
}