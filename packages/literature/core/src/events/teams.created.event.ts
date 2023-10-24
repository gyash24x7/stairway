import type { TeamData } from "@literature/types";
import { GameStatus } from "@literature/types";
import type { IEventHandler } from "@nestjs/cqrs";
import { CommandBus, EventsHandler } from "@nestjs/cqrs";
import { LoggerFactory, RealtimeService } from "@s2h/core";
import { UpdateStatusCommand } from "../commands";
import { Constants, GameEvents } from "../constants";

export class TeamsCreatedEvent {
	constructor(
		public readonly gameId: string,
		public readonly teams: TeamData
	) {}
}

@EventsHandler( TeamsCreatedEvent )
export class TeamsCreatedEventHandler implements IEventHandler<TeamsCreatedEvent> {

	private readonly logger = LoggerFactory.getLogger( TeamsCreatedEventHandler );

	constructor(
		private readonly commandBus: CommandBus,
		private readonly realtimeService: RealtimeService
	) {}

	async handle( { gameId, teams }: TeamsCreatedEvent ) {
		this.logger.debug( ">> handleTeamsCreatedEvent()" );

		await this.commandBus.execute( new UpdateStatusCommand( gameId, GameStatus.TEAMS_CREATED ) );

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			gameId,
			GameEvents.TEAMS_CREATED,
			teams
		);

		this.logger.debug( "<< handleTeamsCreatedEvent()" );
	}
}