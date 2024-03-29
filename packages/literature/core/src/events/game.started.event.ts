import { LoggerFactory } from "@common/core";
import type { CardsData, GameData } from "@literature/data";
import { EventBus, EventsHandler, type IEvent, IEventHandler } from "@nestjs/cqrs";
import { DatabaseService, GatewayService } from "../services";
import { GameEvents } from "../utils";
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
		private readonly db: DatabaseService,
		private readonly eventBus: EventBus,
		private readonly gateway: GatewayService
	) {}

	async handle( { cardsData, gameData }: GameStartedEvent ) {
		this.logger.debug( ">> handleGameStartedEvent()" );

		await this.db.updateGameStatus( gameData.id, "IN_PROGRESS" );

		this.gateway.publishGameEvent( gameData.id, GameEvents.GAME_STARTED, gameData );

		this.eventBus.publish( new HandsUpdatedEvent( gameData.id, cardsData.hands ) );

		this.logger.debug( "<< handleGameStartedEvent()" );
	}
}