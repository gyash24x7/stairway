import type { AskMove, CallMove, InferenceData, Move } from "@literature/types";
import { MoveType } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus, QueryBus } from "@nestjs/cqrs";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { InferenceUpdatedEvent } from "../events";
import { InferenceDataQuery } from "../queries";

export class UpdateInferenceCommand implements ICommand {
	constructor( public readonly currentMove: Move ) {}
}

@CommandHandler( UpdateInferenceCommand )
export class UpdateInferenceCommandHandler implements ICommandHandler<UpdateInferenceCommand, InferenceData> {

	private readonly logger = LoggerFactory.getLogger( UpdateInferenceCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly queryBus: QueryBus,
		private readonly eventBus: EventBus
	) {}

	async execute( { currentMove }: UpdateInferenceCommand ) {
		this.logger.debug( ">> executeUpdateInferencesCommand()" );

		let inferences: InferenceData = await this.queryBus.execute(
			new InferenceDataQuery( currentMove.gameId )
		);

		switch ( currentMove.type ) {
			case MoveType.ASK_CARD:
				inferences = this.updateInferencesOnAskMove( currentMove as AskMove, inferences );
				break;

			case MoveType.CALL_SET:
				inferences = this.updateInferencesOnCallMove( currentMove as CallMove, inferences );
				break;
		}

		if ( currentMove.type !== MoveType.TRANSFER_TURN ) {
			await Promise.all( Object.keys( inferences ).map( playerId => {
				return this.prisma.literature.inference.update( {
					where: { gameId_playerId: { playerId, gameId: currentMove.gameId } },
					data: inferences[ playerId ]
				} );
			} ) );

			this.eventBus.publish( new InferenceUpdatedEvent( currentMove.gameId, inferences ) );
			this.logger.debug( "Published InferenceUpdatedEvent!" );
		}

		this.logger.debug( "<< executeUpdateInferencesCommand()" );
		return inferences;
	}

	private updateInferencesOnCallMove( move: CallMove, inferences: InferenceData ) {
		Object.keys( inferences ).map( playerId => {
			const { actualCardLocations, possibleCardLocations, inferredCardLocations } = inferences[ playerId ];
			Object.keys( move.data.correctCall ).map( card => {
				delete actualCardLocations[ card ];
				delete possibleCardLocations[ card ];
				delete inferredCardLocations[ card ];
			} );

			inferences[ playerId ] = {
				...inferences[ playerId ],
				actualCardLocations,
				possibleCardLocations,
				inferredCardLocations
			};
		} );

		return inferences;
	}

	private updateInferencesOnAskMove( move: AskMove, inferences: InferenceData ) {
		Object.keys( inferences ).map( playerId => {
			const { actualCardLocations, possibleCardLocations, inferredCardLocations } = inferences[ playerId ];
			if ( move.success ) {
				actualCardLocations[ move.data.card ] = move.data.by;
				possibleCardLocations[ move.data.card ] = [ move.data.by ];
			} else {
				possibleCardLocations[ move.data.card ] = possibleCardLocations[ move.data.card ]
					.filter( playerId => playerId !== move.data.from && playerId !== move.data.by );
			}

			inferences[ playerId ] = {
				...inferences[ playerId ],
				actualCardLocations,
				possibleCardLocations,
				inferredCardLocations
			};
		} );

		return inferences;
	}
}