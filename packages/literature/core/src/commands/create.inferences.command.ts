import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type { GameData, HandData, InferenceData } from "@literature/types";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { buildDefaultCardInferences } from "../utils";
import { InferencesUpdatedEvent } from "../events";

export class CreateInferencesCommand implements ICommand {
	constructor(
		public readonly gameData: GameData,
		public readonly hands: HandData
	) {}
}

@CommandHandler( CreateInferencesCommand )
export class CreateInferencesCommandHandler implements ICommandHandler<CreateInferencesCommand, InferenceData> {

	private readonly logger = LoggerFactory.getLogger( CreateInferencesCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { hands, gameData }: CreateInferencesCommand ) {
		this.logger.debug( ">> executeCreateInferencesCommand()" );
		const inferencesData: InferenceData = {};

		await Promise.all(
			Object.values( gameData.players ).map( player => {

				const inferences = buildDefaultCardInferences(
					Object.keys( gameData.players ),
					player.id,
					hands[ player.id ].map( card => card.id )
				);

				inferencesData[ player.id ] = inferences;

				return this.prisma.literature.player.update( {
					where: { id_gameId: { id: player.id, gameId: gameData.id } },
					data: { inferences }
				} );
			} )
		);

		this.eventBus.publish( new InferencesUpdatedEvent( inferencesData, gameData.id ) );
		this.logger.debug( "Published InferencesUpdatedEvent!" );

		this.logger.debug( "<< executeCreateInferencesCommand()" );
		return inferencesData;
	}
}