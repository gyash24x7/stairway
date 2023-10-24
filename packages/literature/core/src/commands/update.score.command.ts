import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type { CallMoveData, Move, PlayerData, ScoreUpdate, TeamData } from "@literature/types";
import { MoveType } from "@literature/types";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { ScoreUpdatedEvent } from "../events";

export class UpdateScoreCommand implements ICommand {
	constructor(
		public readonly currentMove: Move,
		public readonly players: PlayerData,
		public readonly teams: TeamData
	) {}
}

@CommandHandler( UpdateScoreCommand )
export class UpdateScoreCommandHandler implements ICommandHandler<UpdateScoreCommand, ScoreUpdate | undefined> {

	private readonly logger = LoggerFactory.getLogger( UpdateScoreCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( command: UpdateScoreCommand ) {
		this.logger.debug( ">> executeUpdateScoreCommand()" );

		const { currentMove, players, teams } = command;
		const isValid = this.validate( command );
		if ( !isValid ) {
			return;
		}

		const { by, cardSet } = currentMove.data as CallMoveData;
		let winningTeamId = players[ by ].teamId;

		if ( !currentMove.success ) {
			const [ player ] = Object.values( players ).filter( player => player.teamId !== winningTeamId );
			winningTeamId = player.teamId;
		}

		const winningTeam = await this.prisma.literature.team.update( {
			where: { id: winningTeamId! },
			data: {
				score: { increment: 1 },
				setsWon: { push: cardSet }
			}
		} );

		const scoreUpdate: ScoreUpdate = {
			teamId: winningTeam.id,
			score: winningTeam.score,
			setWon: cardSet
		};

		this.eventBus.publish( new ScoreUpdatedEvent( currentMove.gameId, teams, scoreUpdate ) );
		this.logger.debug( "Published ScoreUpdatedEvent!" );

		this.logger.debug( "<< executeUpdateScoreCommand()" );
		return scoreUpdate;
	}

	private validate( { currentMove }: UpdateScoreCommand ) {
		this.logger.debug( ">> validateUpdateScoreCommand()" );

		if ( currentMove.type !== MoveType.CALL_SET ) {
			this.logger.warn( "Current Move is not Call Set, Not Updating Score!" );
			return false;
		}

		this.logger.debug( "<< validateUpdateScoreCommand()" );
		return true;
	}
}