import type { PlayerData } from "@literature/types";
import type { IEvent, IEventHandler } from "@nestjs/cqrs";
import { EventsHandler } from "@nestjs/cqrs";
import { LoggerFactory, RealtimeService } from "@s2h/core";
import { Constants, GameEvents } from "../constants";

export class TurnUpdatedEvent implements IEvent {
	constructor(
		public readonly gameId: string,
		public readonly nextTurn: string,
		public readonly players: PlayerData
	) {}
}

@EventsHandler( TurnUpdatedEvent )
export class TurnUpdatedEventHandler implements IEventHandler<TurnUpdatedEvent> {

	private readonly logger = LoggerFactory.getLogger( TurnUpdatedEventHandler );

	constructor( private readonly realtimeService: RealtimeService ) {}

	async handle( { nextTurn, gameId, players }: TurnUpdatedEvent ) {
		this.logger.debug( ">> handleTurnUpdatedEvent()" );

		const nextPlayer = players[ nextTurn ];
		if ( nextPlayer.isBot ) {
			// TODO: publish bot move command after 10s
		}

		this.realtimeService.publishRoomMessage(
			Constants.LITERATURE,
			gameId,
			GameEvents.TURN_UPDATED,
			nextTurn
		);

		this.logger.debug( "<< handleTurnUpdatedEvent()" );
	}
}