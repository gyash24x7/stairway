import { LoggerFactory } from "@common/core";
import type { Player } from "@literature/data";
import { EventsHandler, type IEvent, IEventHandler } from "@nestjs/cqrs";
import { LiteratureService } from "../utils";

export class PlayerJoinedEvent implements IEvent {
	constructor(
		public readonly player: Player,
		public readonly isCapacityFull: boolean = false
	) {}
}

@EventsHandler( PlayerJoinedEvent )
export class PlayerJoinedEventHandler implements IEventHandler<PlayerJoinedEvent> {

	private readonly logger = LoggerFactory.getLogger( PlayerJoinedEventHandler );

	constructor( private readonly service: LiteratureService ) {}

	async handle( { isCapacityFull, player }: PlayerJoinedEvent ) {
		this.logger.debug( ">> handlePlayerJoinedEvent()" );

		if ( isCapacityFull ) {
			this.logger.debug( "Player Capacity Full for Game: %s", player.gameId );
			await this.service.updateGameStatus( player.gameId, "PLAYERS_READY" );
		}

		// realtimeService.publishRoomMessage(
		// 	Constants.LITERATURE,
		// 	gameId,
		// 	GameEvents.PLAYER_JOINED,
		// 	player
		// );

		this.logger.debug( "<< handlePlayerJoinedEvent()" );
	}
}