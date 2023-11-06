import type { InferenceData } from "@literature/types";
import type { IQuery, IQueryHandler } from "@nestjs/cqrs";
import { QueryHandler } from "@nestjs/cqrs";
import type { CardSet } from "@s2h/cards";
import { LoggerFactory, PrismaService } from "@s2h/core";

export class InferenceDataQuery implements IQuery {
	constructor( public readonly gameId: string ) {}
}

@QueryHandler( InferenceDataQuery )
export class InferenceDataQueryHandler implements IQueryHandler<InferenceDataQuery, InferenceData> {

	private readonly logger = LoggerFactory.getLogger( InferenceDataQueryHandler );

	constructor( private readonly prisma: PrismaService ) {}

	async execute( { gameId }: InferenceDataQuery ) {
		this.logger.debug( ">> executeInferenceDataQuery()" );

		const inferences = await this.prisma.literature.inference.findMany( { where: { gameId } } );

		const inferenceData: InferenceData = {};
		inferences.forEach( inference => {
			inferenceData[ inference.playerId ] = {
				...inference,
				activeSets: inference.activeSets as Record<string, CardSet[]>,
				actualCardLocations: inference.actualCardLocations as Record<string, string>,
				possibleCardLocations: inference.possibleCardLocations as Record<string, string[]>,
				inferredCardLocations: inference.inferredCardLocations as Record<string, string>
			};
		} );

		this.logger.debug( "<< executeInferenceDataQuery()" );
		return inferenceData;
	}
}