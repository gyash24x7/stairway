import { EventsHandler, IEvent, IEventHandler, QueryBus } from "@nestjs/cqrs";
import type { AggregatedGameData, PlayerSpecificGameData } from "@literature/data";
import type { UserAuthInfo } from "@auth/data";
import { PlayerSpecificGameQuery } from "../queries";
import { LoggerFactory, RealtimeService } from "@s2h/core";

export class GameUpdateEvent implements IEvent {
	constructor(
		public readonly currentGame: AggregatedGameData,
		public readonly authInfo: UserAuthInfo
	) {}
}

@EventsHandler( GameUpdateEvent )
export class GameUpdateEventHandler implements IEventHandler<GameUpdateEvent> {

	private readonly logger = LoggerFactory.getLogger( GameUpdateEventHandler );

	constructor(
		private readonly queryBus: QueryBus,
		private readonly realtimeService: RealtimeService
	) {}

	async handle( { currentGame, authInfo }: GameUpdateEvent ) {
		this.logger.debug( ">> handle()" );

		for ( const player of currentGame.playerList ) {
			const playerSpecificData: PlayerSpecificGameData = await this.queryBus.execute(
				new PlayerSpecificGameQuery( currentGame, authInfo )
			);
			this.realtimeService.publishDirectMessage( "literature", currentGame.id + player.id, playerSpecificData );
		}
	}
}