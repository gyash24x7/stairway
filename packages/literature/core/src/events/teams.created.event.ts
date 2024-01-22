import { LoggerFactory } from "@common/core";
import type { TeamData } from "@literature/data";
import { EventsHandler, type IEvent, IEventHandler } from "@nestjs/cqrs";
import { LiteratureService } from "../utils";

export class TeamsCreatedEvent implements IEvent {
	constructor(
		public readonly teams: TeamData,
		public readonly gameId: string
	) {}
}

@EventsHandler( TeamsCreatedEvent )
export class TeamsCreatedEventHandler implements IEventHandler<TeamsCreatedEvent> {

	private readonly logger = LoggerFactory.getLogger( TeamsCreatedEventHandler );

	constructor( private readonly service: LiteratureService ) {}

	async handle( { gameId }: TeamsCreatedEvent ) {
		this.logger.debug( ">> handleTeamsCreatedEvent()" );

		await this.service.updateGameStatus( gameId, "TEAMS_CREATED" );

		// realtimeService.publishRoomMessage(
		// 	Constants.LITERATURE,
		// 	gameId,
		// 	GameEvents.TEAMS_CREATED,
		// 	teams
		// );

		this.logger.debug( "<< handleTeamsCreatedEvent()" );
	}
}