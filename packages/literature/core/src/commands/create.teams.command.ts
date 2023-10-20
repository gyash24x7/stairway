import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type { AggregatedGameData, CreateTeamsInput } from "@literature/data";
import { GameStatus } from "@literature/data";
import { BadRequestException } from "@nestjs/common";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { GameUpdateEvent } from "../events";
import type { UserAuthInfo } from "@auth/data";
import { Messages } from "../constants";

export class CreateTeamsCommand implements ICommand {
	constructor(
		public readonly input: CreateTeamsInput,
		public readonly currentGame: AggregatedGameData,
		public readonly authInfo: UserAuthInfo
	) {}
}

@CommandHandler( CreateTeamsCommand )
export class CreateTeamsCommandHandler implements ICommandHandler<CreateTeamsCommand, string> {

	private readonly logger = LoggerFactory.getLogger( CreateTeamsCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { input, currentGame, authInfo }: CreateTeamsCommand ) {
		this.logger.debug( ">> execute()" );
		if ( currentGame.status !== GameStatus.PLAYERS_READY ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_NOT_IN_REQUIRED_STATUS, currentGame.id );
			throw new BadRequestException( Messages.GAME_NOT_IN_REQUIRED_STATUS );
		}

		if ( currentGame.playerList.length !== currentGame.playerCount ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS, currentGame.id );
			throw new BadRequestException( Messages.GAME_DOESNT_HAVE_ENOUGH_PLAYERS );
		}

		const [ teamA, teamB ] = await Promise.all(
			Object.keys( input.data ).map( teamName => {
				return this.prisma.literature.team.create( {
					data: {
						name: teamName,
						gameId: currentGame.id,
						members: {
							connect: input.data[ teamName ].map( ( memberId ) => {
								return { id_gameId: { id: memberId, gameId: currentGame.id } };
							} )
						}
					}
				} );
			} )
		);

		currentGame.teamList = [ teamA, teamB ];
		currentGame.teams = {
			[ teamA.id ]: teamA,
			[ teamB.id ]: teamB
		};

		currentGame.teamList.map( team => {
			input.data[ team.name ].map( ( memberId ) => {
				currentGame.players[ memberId ].teamId = team.id;
			} );
		} );

		await this.prisma.literature.game.update( {
			where: { id: currentGame.id },
			data: { status: GameStatus.TEAMS_CREATED }
		} );

		currentGame.status = GameStatus.TEAMS_CREATED;

		this.eventBus.publish( new GameUpdateEvent( currentGame, authInfo ) );

		return currentGame.id;
	}
}