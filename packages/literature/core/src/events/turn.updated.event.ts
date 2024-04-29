import { LoggerFactory } from "@common/core";
import type { GameData } from "@literature/data";
import { EventsHandler, type IEvent, IEventHandler } from "@nestjs/cqrs";
import { GatewayService } from "../services";
import { GameEvents } from "../utils";

export class TurnUpdatedEvent implements IEvent {
	constructor(
		public readonly gameData: GameData,
		public readonly nextTurn: string
	) {}
}

@EventsHandler( TurnUpdatedEvent )
export class TurnUpdatedEventHandler implements IEventHandler<TurnUpdatedEvent> {

	private readonly logger = LoggerFactory.getLogger( TurnUpdatedEventHandler );

	constructor(
		// private readonly commandBus: CommandBus,
		private readonly gateway: GatewayService
	) {}

	async handle( { nextTurn, gameData }: TurnUpdatedEvent ) {
		this.logger.debug( ">> handleTurnUpdated()" );

		const nextPlayer = gameData.players[ nextTurn ];
		if ( nextPlayer.isBot ) {
			// TODO: publish bot move command after 10s

			// setTimeout( async () => {
			// 	const command = new ExecuteBotMoveCommand( gameData, nextPlayer.id );
			// 	await this.commandBus.execute( command );
			// }, 5000 );
		}

		this.gateway.publishGameEvent( gameData.id, GameEvents.TURN_UPDATED, nextTurn );

		this.logger.debug( "<< handleTurnUpdated()" );
	}
}