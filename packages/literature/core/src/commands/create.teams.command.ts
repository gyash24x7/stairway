import { LoggerFactory } from "@common/core";
import type { CreateTeamsInput, GameData, TeamData } from "@literature/data";
import { CommandHandler, EventBus, ICommand, ICommandHandler } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import { TeamsCreatedEvent } from "../events";
import { DatabaseService } from "../services";
import { Messages } from "../utils";

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
		private readonly db: DatabaseService,
		private readonly eventBus: EventBus
	) {}

	async execute( command: CreateTeamsCommand ): Promise<TeamData> {
		this.logger.debug( ">> createTeams()" );

		await this.validate( command );
		const { input, gameData } = command;

		const [ teamA, teamB ] = await this.db.createTeams(
			Object.keys( input.data ).map( name => {
				return { name, gameId: gameData.id, memberIds: input.data[ name ] };
			} )
		);

		const teamData: TeamData = { [ teamA.id ]: teamA, [ teamB.id ]: teamB };

		await this.db.assignTeamsToPlayers( teamData );

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