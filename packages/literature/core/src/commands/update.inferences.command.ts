import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type { AskMoveData, CallMoveData, CardInferences, InferenceData, Move, PlayerData } from "@literature/types";
import { MoveType } from "@literature/types";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { InferencesUpdatedEvent } from "../events";

export class UpdateInferencesCommand implements ICommand {
	constructor(
		public readonly currentMove: Move,
		public readonly players: PlayerData
	) {}
}

@CommandHandler( UpdateInferencesCommand )
export class UpdateInferencesCommandHandler implements ICommandHandler<UpdateInferencesCommand, InferenceData> {

	private readonly logger = LoggerFactory.getLogger( UpdateInferencesCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { currentMove, players }: UpdateInferencesCommand ) {
		this.logger.debug( ">> executeUpdateInferencesCommand()" );

		const inferencesData: InferenceData = {};

		await Promise.all( Object.values( players ).map( player => {
			const inferenceDataForPlayer = player.inferences as CardInferences;

			switch ( currentMove.type ) {
				case MoveType.ASK_CARD:
					const { card, from, by } = currentMove.data as AskMoveData;
					if ( currentMove.success ) {
						inferenceDataForPlayer[ card ] = [ by ];
					} else {
						inferenceDataForPlayer[ card ] = inferenceDataForPlayer[ card ]
							.filter( playerId => playerId !== from || playerId !== by );
					}
					break;

				case MoveType.CALL_SET:
					const { correctCall } = currentMove.data as CallMoveData;
					Object.keys( correctCall ).map( card => {
						delete inferenceDataForPlayer[ card ];
					} );
					break;

				case MoveType.TRANSFER_CHANCE:
					break;
			}

			inferencesData[ player.id ] = inferenceDataForPlayer;

			return this.prisma.literature.player.update( {
				where: { id_gameId: { id: player.id, gameId: currentMove.gameId } },
				data: { inferences: inferenceDataForPlayer }
			} );
		} ) );

		this.eventBus.publish( new InferencesUpdatedEvent( inferencesData, currentMove.gameId ) );
		this.logger.debug( "Published InferencesUpdatedEvent! Data: %o", inferencesData );

		this.logger.debug( "<< executeUpdateInferencesCommand()" );
		return inferencesData;
	}
}