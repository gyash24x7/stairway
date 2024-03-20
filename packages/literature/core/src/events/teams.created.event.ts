import { LoggerFactory } from "@common/core";
import type { TeamData } from "@literature/data";
import { EventsHandler, type IEvent, IEventHandler } from "@nestjs/cqrs";
import { DatabaseService, GatewayService } from "../services";
import { GameEvents } from "../utils";

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
		private readonly db: DatabaseService,
		private readonly gateway: GatewayService
	) {}

	async handle( { gameId, teams }: TeamsCreatedEvent ) {
		this.logger.debug( ">> handleTeamsCreatedEvent()" );

		await this.db.updateGameStatus( gameId, "TEAMS_CREATED" );
		this.gateway.publishGameEvent( gameId, GameEvents.STATUS_UPDATED, "TEAMS_CREATED" );

		this.gateway.publishGameEvent( gameId, GameEvents.TEAMS_CREATED, teams );

		this.logger.debug( "<< handleTeamsCreatedEvent()" );
	}
}