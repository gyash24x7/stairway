import { LoggerFactory } from "@backend/utils";
import { CommandHandler, EventBus, type ICommand, type ICommandHandler } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import { TeamsCreatedEvent } from "../events";
import { Messages } from "../literature.constants.ts";
import { LiteratureRepository } from "../literature.repository.ts";
import type { GameData, TeamData } from "../literature.types.ts";

export type CreateTeamsInput = {
	gameId: string;
	data: Record<string, string[]>;
}

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
		private readonly repository: LiteratureRepository,
		private readonly eventBus: EventBus
	) {}

	async execute( command: CreateTeamsCommand ): Promise<TeamData> {
		this.logger.debug( ">> createTeams()" );

		await this.validate( command );
		const { input, gameData } = command;

		const [ teamA, teamB ] = await this.repository.createTeams(
			Object.keys( input.data ).map( name => {
				return { name, gameId: gameData.id, memberIds: input.data[ name ] };
			} )
		);

		const teamData: TeamData = { [ teamA.id ]: teamA, [ teamB.id ]: teamB };
		await this.repository.assignTeamsToPlayers( teamData );

		const event = new TeamsCreatedEvent( teamData, gameData.id );
		this.eventBus.publish( event );
		this.logger.debug( "Published TeamsCreatedEvent!" );

		this.logger.debug( "<< createTeams()" );
		return teamData;
	}

	async validate( { gameData }: CreateTeamsCommand ) {
		this.logger.debug( ">> validateCreateTeamsRequest()" );

		if ( Object.keys( gameData.players ).length !== gameData.playerCount ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS, gameData.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS } );
		}

		this.logger.debug( "<< validateCreateTeamsRequest()" );
	}
}