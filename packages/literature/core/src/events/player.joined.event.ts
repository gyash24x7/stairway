import type { Player } from "@literature/types";
import { GameStatus } from "@literature/types";
import type { IEvent, IEventHandler } from "@nestjs/cqrs";
import { CommandBus, EventsHandler } from "@nestjs/cqrs";
import { LoggerFactory, RealtimeService } from "@s2h/core";
import { UpdateStatusCommand } from "../commands";
import { Constants, GameEvents } from "../constants";

export class PlayerJoinedEvent implements IEvent {
	constructor(
		public readonly gameId: string,
		public readonly player: Player,
		public readonly isCapacityFull: boolean
	) {}
}

@EventsHandler( PlayerJoinedEvent )
export class PlayerJoinedEventHandler implements IEventHandler<PlayerJoinedEvent> {

	private readonly logger = LoggerFactory.getLogger( PlayerJoinedEventHandler );

	constructor(
		private readonly commandBus: CommandBus,
		private readonly realtimeService: RealtimeService
	) {}

	async handle( { gameId, isCapacityFull, player }: PlayerJoinedEvent ) {
		this.logger.debug( ">> handlePlayerJoinedEvent()" );

		if ( isCapacityFull ) {
			this.logger.debug( "Player Capacity Full for Game: %s", gameId );
			await this.commandBus.execute( new UpdateStatusCommand( gameId, GameStatus.PLAYERS_READY ) );
		}

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			gameId,
			GameEvents.PLAYER_JOINED,
			player
		);

		this.logger.debug( "<< handlePlayerJoinedEvent()" );
	}
}