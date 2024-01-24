import { LoggerFactory } from "@common/core";
import type { PlayerData } from "@literature/data";
import { EventsHandler, type IEvent, IEventHandler } from "@nestjs/cqrs";
import { GameEvents, LiteratureGateway } from "../utils";

export class TurnUpdatedEvent implements IEvent {
	constructor(
		public readonly gameId: string,
		public readonly players: PlayerData,
		public readonly nextTurn: string
	) {}
}

@EventsHandler( TurnUpdatedEvent )
export class TurnUpdatedEventHandler implements IEventHandler<TurnUpdatedEvent> {

	private readonly logger = LoggerFactory.getLogger( TurnUpdatedEventHandler );

	constructor( private readonly gateway: LiteratureGateway ) {}

	async handle( { players, nextTurn, gameId }: TurnUpdatedEvent ) {
		this.logger.debug( ">> handleTurnUpdated()" );

		const nextPlayer = players[ nextTurn ];
		if ( nextPlayer.isBot ) {
			// TODO: publish bot move command after 10s
		}

		this.gateway.publishGameEvent( gameId, GameEvents.TURN_UPDATED, nextTurn );

		this.logger.debug( "<< handleTurnUpdated()" );
	}
}