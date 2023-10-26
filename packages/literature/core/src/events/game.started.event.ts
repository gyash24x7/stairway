import type { CardMappingData, GameData } from "@literature/types";
import { GameStatus } from "@literature/types";
import type { IEvent, IEventHandler } from "@nestjs/cqrs";
import { CommandBus, EventsHandler } from "@nestjs/cqrs";
import { LoggerFactory, RealtimeService } from "@s2h/core";
import { CreateInferencesCommand, UpdateStatusCommand } from "../commands";
import { Constants, GameEvents } from "../constants";
import { buildHandData } from "../utils";

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
		private readonly realtimeService: RealtimeService
	) {}

	async handle( { gameData, cardMappings }: GameStartedEvent ) {
		this.logger.debug( ">> handleGameStartedEvent()" );
		const handData = buildHandData( cardMappings );

		await this.commandBus.execute( new CreateInferencesCommand( gameData, handData ) );
		await this.commandBus.execute( new UpdateStatusCommand( gameData.id, GameStatus.IN_PROGRESS ) );

		Object.keys( gameData.players ).forEach( playerId => {
			this.realtimeService.publishDirectMessage(
				Constants.LITERATURE,
				gameData.id,
				playerId,
				GameEvents.HAND_UPDATED,
				handData[ playerId ]
			);
		} );

		this.logger.debug( "<< handleGameStartedEvent()" );
	}
}