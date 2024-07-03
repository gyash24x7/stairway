import { LoggerFactory } from "@backend/utils";
import { EventsHandler, type IEvent, type IEventHandler } from "@nestjs/cqrs";
import { GameEvents } from "../literature.constants.ts";
import { LiteratureGateway } from "../literature.gateway.ts";
import { LiteratureRepository } from "../literature.repository.ts";
import type { Player } from "../literature.types.ts";

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
		private readonly repository: LiteratureRepository,
		private readonly gateway: LiteratureGateway
	) {}

	async handle( { isCapacityFull, player }: PlayerJoinedEvent ) {
		this.logger.debug( ">> handlePlayerJoinedEvent()" );

		if ( isCapacityFull ) {
			this.logger.debug( "Player Capacity Full for Game: %s", player.gameId );
			await this.repository.updateGameStatus( player.gameId, "PLAYERS_READY" );
			this.gateway.publishGameEvent( player.gameId, GameEvents.STATUS_UPDATED, "PLAYERS_READY" );
		}

		this.gateway.publishGameEvent( player.gameId, GameEvents.PLAYER_JOINED, player );

		this.logger.debug( "<< handlePlayerJoinedEvent()" );
	}
}