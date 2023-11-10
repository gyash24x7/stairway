import type { GameData, HandData, Inference, InferenceData } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import { SORTED_DECK } from "@s2h/cards";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { InferenceUpdatedEvent } from "../events";

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
			Object.keys( gameData.players ).map( playerId => {

				const inference: Omit<Inference, "gameId" | "playerId"> = {
					activeSets: {},
					actualCardLocations: {},
					possibleCardLocations: {},
					inferredCardLocations: {}
				};

				const defaultProbablePlayers = Object.keys( gameData.players ).filter( player => player !== playerId );

				Object.keys( gameData.teams ).forEach( teamId => {
					inference.activeSets[ teamId ] = [];
				} );

				const cards = hands[ playerId ].map( card => card.id );

				SORTED_DECK.forEach( card => {
					if ( cards.includes( card.id ) ) {
						inference.actualCardLocations[ card.id ] = playerId;
						inference.possibleCardLocations[ card.id ] = [ playerId ];
					} else {
						inference.possibleCardLocations[ card.id ] = defaultProbablePlayers;
					}
				} );

				inferenceData[ playerId ] = { ...inference, gameId: gameData.id, playerId };

				return this.prisma.literature.inference.create( {
					data: inferenceData[ playerId ]
				} );
			} )
		);

		this.eventBus.publish( new InferenceUpdatedEvent( gameData.id, inferenceData ) );
		this.logger.debug( "Published InferenceUpdatedEvent!" );

		this.logger.debug( "<< executeCreateInferencesCommand()" );
		return inferenceData;
	}
}