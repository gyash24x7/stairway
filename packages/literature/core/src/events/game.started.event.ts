import type { CardsData, GameData } from "@literature/types";
import { GameStatus } from "@literature/types";
import type { IEvent, IEventHandler } from "@nestjs/cqrs";
import { CommandBus, EventBus, EventsHandler } from "@nestjs/cqrs";
import { LoggerFactory } from "@s2h/core";
import { CreateInferenceCommand, UpdateStatusCommand } from "../commands";
import { HandsUpdatedEvent } from "./hands.updated.event";

export class GameStartedEvent implements IEvent {
	constructor(
		public readonly gameData: GameData,
		public readonly cardsData: CardsData
	) {}
}

@EventsHandler( GameStartedEvent )
export class GameStartedEventHandler implements IEventHandler<GameStartedEvent> {

	private readonly logger = LoggerFactory.getLogger( GameStartedEventHandler );

	constructor(
		private readonly commandBus: CommandBus,
		private readonly eventBus: EventBus
	) {}

	async handle( { gameData, cardsData }: GameStartedEvent ) {
		this.logger.debug( ">> handleGameStartedEvent()" );

		await this.commandBus.execute( new CreateInferenceCommand( gameData, cardsData.hands ) );
		await this.commandBus.execute( new UpdateStatusCommand( gameData.id, GameStatus.IN_PROGRESS ) );
		await this.eventBus.publish( new HandsUpdatedEvent( gameData.id, cardsData.hands ) );

		this.logger.debug( "<< handleGameStartedEvent()" );
	}
}