import { LoggerFactory } from "@common/core";
import type { Player } from "@literature/data";
import { EventsHandler, type IEvent, IEventHandler } from "@nestjs/cqrs";
import { DatabaseService, GatewayService } from "../services";
import { GameEvents } from "../utils";

export class PlayerJoinedEvent implements IEvent {
	constructor(
		public readonly player: Player,
		public readonly isCapacityFull: boolean = false
	) {}
}

@EventsHandler( PlayerJoinedEvent )
export class PlayerJoinedEventHandler implements IEventHandler<PlayerJoinedEvent> {

	private readonly logger = LoggerFactory.getLogger( PlayerJoinedEventHandler );

	constructor(
		private readonly db: DatabaseService,
		private readonly gateway: GatewayService
	) {}

	async handle( { isCapacityFull, player }: PlayerJoinedEvent ) {
		this.logger.debug( ">> handlePlayerJoinedEvent()" );

		if ( isCapacityFull ) {
			this.logger.debug( "Player Capacity Full for Game: %s", player.gameId );
			await this.db.updateGameStatus( player.gameId, "PLAYERS_READY" );
			this.gateway.publishGameEvent( player.gameId, GameEvents.STATUS_UPDATED, "PLAYERS_READY" );
		}

		this.gateway.publishGameEvent( player.gameId, GameEvents.PLAYER_JOINED, player );

		this.logger.debug( "<< handlePlayerJoinedEvent()" );
	}
}