import type { IEvent, IEventHandler } from "@nestjs/cqrs";
import { CommandBus, EventsHandler } from "@nestjs/cqrs";
import type { CardMappingData, GameData, Move } from "@literature/types";
import { LoggerFactory, RealtimeService } from "@s2h/core";
import { UpdateHandsCommand, UpdateInferencesCommand, UpdateScoreCommand, UpdateTurnCommand } from "../commands";
import { Constants, GameEvents } from "../constants";

export class MoveCreatedEvent implements IEvent {
	constructor(
		public readonly move: Move,
		public readonly gameData: GameData,
		public readonly cardMappings: CardMappingData
	) {}
}

@EventsHandler( MoveCreatedEvent )
export class MoveCreatedEventHandler implements IEventHandler<MoveCreatedEvent> {

	private readonly logger = LoggerFactory.getLogger( MoveCreatedEventHandler );

	constructor(
		private readonly commandBus: CommandBus,
		private readonly realtimeService: RealtimeService
	) {}

	async handle( { move, gameData, cardMappings }: MoveCreatedEvent ) {
		this.logger.debug( ">> handleMoveCreatedEvent" );

		await this.commandBus.execute( new UpdateInferencesCommand( move, gameData.players ) );
		await this.commandBus.execute( new UpdateHandsCommand( move, cardMappings ) );
		await this.commandBus.execute( new UpdateTurnCommand( gameData.currentTurn, move, gameData.players ) );
		await this.commandBus.execute( new UpdateScoreCommand( move, gameData.players, gameData.teams ) );

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			move.gameId,
			GameEvents.MOVE_CREATED,
			move
		);

		this.logger.debug( "<< handleMoveCreatedEvent" );
	}
}