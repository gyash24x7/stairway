import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type { AggregatedGameData, CreateTeamsInput } from "@literature/data";
import { GameStatus } from "@literature/data";
import { BadRequestException } from "@nestjs/common";
import { LoggerFactory } from "@s2h/core";
import { PrismaService } from "../services";
import { GameUpdateEvent } from "../events";
import type { UserAuthInfo } from "@auth/data";

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
			this.logger.error( "The Game is not in current status! GameId: %s", currentGame.id );
			throw new BadRequestException();
		}

		if ( currentGame.playerList.length !== currentGame.playerCount ) {
			this.logger.error( "The Game doesn't have enough players! GameId: %s", currentGame.id );
			throw new BadRequestException();
		}

		const [ teamA, teamB ] = await Promise.all(
			Object.keys( input.data ).map( teamName => {
				return this.prisma.team.create( {
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

		await this.prisma.game.update( {
			where: { id: currentGame.id },
			data: { status: GameStatus.TEAMS_CREATED }
		} );

		currentGame.status = GameStatus.TEAMS_CREATED;

		this.eventBus.publish( new GameUpdateEvent( currentGame, authInfo ) );

		return currentGame.id;
	}
}