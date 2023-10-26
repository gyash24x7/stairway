import type { AskMove, CallMove, CardInferences, InferenceData, Move, PlayerData } from "@literature/types";
import { MoveType } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
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

		let inferencesData: InferenceData = {};

		switch ( currentMove.type ) {
			case MoveType.ASK_CARD:
				inferencesData = this.updateInferencesOnAskMove( currentMove as AskMove, players );
				break;

			case MoveType.CALL_SET:
				inferencesData = this.updateInferencesOnCallMove( currentMove as CallMove, players );
				break;

			case MoveType.TRANSFER_TURN:
				inferencesData = this.getCurrentCardInferenceData( players );
				break;
		}

		if ( currentMove.type !== MoveType.TRANSFER_TURN ) {
			await Promise.all( Object.keys( inferencesData ).map( playerId => {
				return this.prisma.literature.player.update( {
					where: { id_gameId: { id: playerId, gameId: currentMove.gameId } },
					data: { inferences: inferencesData[ playerId ] }
				} );
			} ) );

			this.eventBus.publish( new InferencesUpdatedEvent( inferencesData, currentMove.gameId ) );
			this.logger.debug( "Published InferencesUpdatedEvent!" );
		}

		this.logger.debug( "<< executeUpdateInferencesCommand()" );
		return inferencesData;
	}

	private getCurrentCardInferenceData( players: PlayerData ) {
		const inferenceData: InferenceData = {};

		Object.values( players ).map( player => {
			inferenceData[ player.id ] = { ...player.inferences as CardInferences };
		} );

		return inferenceData;
	}

	private updateInferencesOnCallMove( move: CallMove, players: PlayerData ) {
		const inferencesData: InferenceData = {};

		Object.values( players ).map( player => {
			const inferenceDataForPlayer = { ...player.inferences as CardInferences };
			Object.keys( move.data.correctCall ).map( card => {
				delete inferenceDataForPlayer[ card ];
			} );

			inferencesData[ player.id ] = inferenceDataForPlayer;
		} );

		return inferencesData;
	}

	private updateInferencesOnAskMove( move: AskMove, players: PlayerData ) {
		const inferencesData: InferenceData = {};

		Object.values( players ).map( player => {
			const inferenceDataForPlayer = { ...player.inferences as CardInferences };
			if ( move.success ) {
				inferenceDataForPlayer[ move.data.card ] = [ move.data.by ];
			} else {
				inferenceDataForPlayer[ move.data.card ] = inferenceDataForPlayer[ move.data.card ]
					.filter( playerId => playerId !== move.data.from && playerId !== move.data.by );
			}

			inferencesData[ player.id ] = inferenceDataForPlayer;
		} );

		return inferencesData;
	}
}