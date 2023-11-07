import type { GameData, HandData, InferenceData } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { InferenceUpdatedEvent } from "../events";
import { buildDefaultInference } from "../utils";

export class CreateInferenceCommand implements ICommand {
	constructor(
		public readonly gameData: GameData,
		public readonly hands: HandData
	) {}
}

@CommandHandler( CreateInferenceCommand )
export class CreateInferenceCommandHandler implements ICommandHandler<CreateInferenceCommand, InferenceData> {

	private readonly logger = LoggerFactory.getLogger( CreateInferenceCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { hands, gameData }: CreateInferenceCommand ) {
		this.logger.debug( ">> executeCreateInferencesCommand()" );
		const inferenceData: InferenceData = {};

		await Promise.all(
			Object.values( gameData.players ).map( player => {

				const inference = buildDefaultInference(
					Object.keys( gameData.players ),
					Object.keys( gameData.teams ),
					player.id,
					hands[ player.id ].map( card => card.id )
				);

				inferenceData[ player.id ] = { ...inference, gameId: gameData.id };

				return this.prisma.literature.inference.create( {
					data: inferenceData[ player.id ]
				} );
			} )
		);

		this.eventBus.publish( new InferenceUpdatedEvent( gameData.id, inferenceData ) );
		this.logger.debug( "Published InferenceUpdatedEvent!" );

		this.logger.debug( "<< executeCreateInferencesCommand()" );
		return inferenceData;
	}
}