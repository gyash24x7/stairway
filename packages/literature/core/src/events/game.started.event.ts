import type { CardMappingData, GameData } from "@literature/types";
import { GameStatus } from "@literature/types";
import type { IEvent, IEventHandler } from "@nestjs/cqrs";
import { CommandBus, EventBus, EventsHandler } from "@nestjs/cqrs";
import { LoggerFactory } from "@s2h/core";
import { CreateInferencesCommand, UpdateStatusCommand } from "../commands";
import { buildHandData } from "../utils";
import { HandsUpdatedEvent } from "./hands.updated.event";

export class GameStartedEvent implements IEvent {
	constructor(
		public readonly gameData: GameData,
		public readonly cardMappings: CardMappingData
	) {}
}

@EventsHandler( GameStartedEvent )
export class GameStartedEventHandler implements IEventHandler<GameStartedEvent> {

	private readonly logger = LoggerFactory.getLogger( GameStartedEventHandler );

	constructor(
		private readonly commandBus: CommandBus,
		private readonly eventBus: EventBus
	) {}

	async handle( { gameData, cardMappings }: GameStartedEvent ) {
		this.logger.debug( ">> handleGameStartedEvent()" );
		const handData = buildHandData( cardMappings );

		await this.commandBus.execute( new CreateInferencesCommand( gameData, handData ) );
		await this.commandBus.execute( new UpdateStatusCommand( { ...gameData, status: GameStatus.IN_PROGRESS } ) );
		await this.eventBus.publish( new HandsUpdatedEvent( gameData, handData ) );

		this.logger.debug( "<< handleGameStartedEvent()" );
	}
}