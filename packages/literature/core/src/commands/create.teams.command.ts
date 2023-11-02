import type { CreateTeamsInput, GameData, TeamData } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { TeamsCreatedEvent } from "../events";
import { CreateTeamsValidator } from "../validators";

export class CreateTeamsCommand implements ICommand {
	constructor(
		public readonly input: CreateTeamsInput,
		public readonly gameData: GameData
	) {}
}

@CommandHandler( CreateTeamsCommand )
export class CreateTeamsCommandHandler implements ICommandHandler<CreateTeamsCommand, TeamData> {

	private readonly logger = LoggerFactory.getLogger( CreateTeamsCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly validator: CreateTeamsValidator,
		private readonly eventBus: EventBus
	) {}

	async execute( { input, gameData }: CreateTeamsCommand ) {
		this.logger.debug( ">> executeCreateTeamsCommand()" );

		await this.validator.validate( { input, gameData } );

		const [ teamA, teamB ] = await Promise.all(
			Object.keys( input.data ).map( teamName => {
				return this.prisma.literature.team.create( {
					data: {
						name: teamName,
						gameId: gameData.id,
						members: {
							connect: input.data[ teamName ].map( ( memberId ) => {
								return { id_gameId: { id: memberId, gameId: gameData.id } };
							} )
						}
					}
				} );
			} )
		);

		const teamMap: TeamData = {
			[ teamA.id ]: { ...teamA, members: input.data[ teamA.name ] },
			[ teamB.id ]: { ...teamB, members: input.data[ teamB.name ] }
		};

		this.eventBus.publish( new TeamsCreatedEvent( gameData.id, teamMap ) );
		this.logger.debug( "Published TeamsCreatedEvent!" );

		this.logger.debug( "<< executeCreateTeamsCommand()" );
		return teamMap;
	}
}