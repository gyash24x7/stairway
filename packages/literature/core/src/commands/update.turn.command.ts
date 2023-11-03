import type { AskMoveData, CallMoveData, Move, PlayerData, TransferMoveData } from "@literature/types";
import { MoveType } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import { shuffle } from "@s2h/cards";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { TurnUpdatedEvent } from "../events";

export class UpdateTurnCommand implements ICommand {
	constructor(
		public readonly currentTurn: string,
		public readonly currentMove: Move,
		public readonly players: PlayerData
	) {}
}

@CommandHandler( UpdateTurnCommand )
export class UpdateTurnCommandHandler implements ICommandHandler<UpdateTurnCommand, string> {

	private readonly logger = LoggerFactory.getLogger( UpdateTurnCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { currentTurn, currentMove, players }: UpdateTurnCommand ) {
		this.logger.debug( ">> executeUpdateTurnCommand()" );
		let nextTurn: string;

		switch ( currentMove.type ) {
			case MoveType.ASK_CARD: {
				this.logger.debug( "CurrentMove is ASK_MOVE!" );
				const { from, by } = currentMove.data as AskMoveData;
				nextTurn = !currentMove.success ? from : by;
				break;
			}

			case MoveType.CALL_SET: {
				this.logger.debug( "CurrentMoveType is CALL_SET!" );
				const { by } = currentMove.data as CallMoveData;
				const currentTeam = players[ by ].teamId;
				const [ player ] = shuffle( Object.values( players )
					.filter( player => player.teamId !== currentTeam ) );
				nextTurn = !currentMove.success ? player.id : by;
				break;
			}

			default: {
				this.logger.debug( "CurrentMoveType is TRANSFER_TURN!" );
				const data = currentMove.data as TransferMoveData;
				nextTurn = data.to;
				break;
			}
		}

		if ( nextTurn !== currentTurn ) {
			await this.prisma.literature.game.update( {
				where: { id: currentMove.gameId },
				data: { currentTurn: nextTurn }
			} );

			this.eventBus.publish( new TurnUpdatedEvent( nextTurn, currentMove.gameId ) );
			this.logger.debug( "Published TurnUpdatedEvent!" );
		}

		this.logger.debug( "<< executeUpdateTurnCommand()" );
		return nextTurn;
	}
}