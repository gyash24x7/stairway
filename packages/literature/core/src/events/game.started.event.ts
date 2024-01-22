import { LoggerFactory } from "@common/core";
import type { CardsData, GameData } from "@literature/data";
import { EventBus, EventsHandler, type IEvent, IEventHandler } from "@nestjs/cqrs";
import { LiteratureService } from "../utils";
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
		private readonly service: LiteratureService,
		private readonly eventBus: EventBus
	) {}

	async handle( { cardsData, gameData }: GameStartedEvent ) {
		this.logger.debug( ">> handleGameStartedEvent()" );

		await this.service.updateGameStatus( gameData.id, "IN_PROGRESS" );

		// realtimeService.publishRoomMessage(
		// 	Constants.LITERATURE,
		// 	gameId,
		// 	GameEvents.GAME_STARTED,
		// 	game
		// );

		this.eventBus.publish( new HandsUpdatedEvent( gameData.id, cardsData.hands ) );

		this.logger.debug( "<< handleGameStartedEvent()" );
	}
}