import type { IEvent, IEventHandler } from "@nestjs/cqrs";
import { CommandBus, EventsHandler } from "@nestjs/cqrs";
import { LoggerFactory, RealtimeService } from "@s2h/core";
import { Constants, GameEvents } from "../constants";
import type { ScoreUpdate, TeamData } from "@literature/types";
import { GameStatus } from "@literature/types";
import type { CardSet } from "@s2h/cards";
import { UpdateStatusCommand } from "../commands";

export class ScoreUpdatedEvent implements IEvent {
	constructor(
		public readonly gameId: string,
		public readonly teams: TeamData,
		public readonly scoreUpdate: ScoreUpdate
	) {}
}

@EventsHandler( ScoreUpdatedEvent )
export class ScoreUpdatedEventHandler implements IEventHandler<ScoreUpdatedEvent> {

	private readonly logger = LoggerFactory.getLogger( ScoreUpdatedEventHandler );

	constructor(
		private readonly commandBus: CommandBus,
		private readonly realtimeService: RealtimeService
	) {}

	async handle( { scoreUpdate, gameId, teams }: ScoreUpdatedEvent ) {
		this.logger.debug( ">> handleScoreUpdatedEvent()" );

		const setsCompleted: CardSet[] = [ scoreUpdate.setWon ];
		Object.values( teams ).forEach( team => {
			setsCompleted.push( ...team.setsWon as CardSet[] );
		} );

		if ( setsCompleted.length === 8 ) {
			await this.commandBus.execute( new UpdateStatusCommand( gameId, GameStatus.COMPLETED ) );
		}

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			gameId,
			GameEvents.SCORE_UPDATED,
			scoreUpdate
		);

		this.logger.debug( "<< handleScoreUpdatedEvent()" );
	}
}