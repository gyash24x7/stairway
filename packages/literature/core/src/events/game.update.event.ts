import { EventsHandler, IEvent, IEventHandler, QueryBus } from "@nestjs/cqrs";
import type { AggregatedGameData, PlayerSpecificGameData } from "@literature/data";
import type { UserAuthInfo } from "@auth/data";
import { AggregatedGameQuery, PlayerSpecificGameQuery } from "../queries";
import { LoggerFactory, RealtimeService } from "@s2h/core";

export class GameUpdateEvent implements IEvent {
	constructor(
		public readonly gameId: string,
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

	async handle( { gameId, authInfo }: GameUpdateEvent ) {
		this.logger.debug( ">> handle()" );
		const aggregatedData: AggregatedGameData = await this.queryBus.execute( new AggregatedGameQuery( gameId ) );

		for ( const player of aggregatedData.playerList ) {
			const playerSpecificData: PlayerSpecificGameData = await this.queryBus.execute(
				new PlayerSpecificGameQuery( aggregatedData, authInfo )
			);
			this.realtimeService.publishMessage( "LITERATURE", gameId + player.id, playerSpecificData );
		}
	}
}