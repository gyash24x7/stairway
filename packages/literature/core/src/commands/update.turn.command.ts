import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type { AskMoveData, CallMoveData, Move, Player, TransferMoveData } from "@literature/types";
import { MoveType } from "@literature/types";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { shuffle } from "@s2h/cards";
import { TurnUpdatedEvent } from "../events";

export class UpdateTurnCommand implements ICommand {
	constructor(
		public readonly currentMove: Move,
		public readonly players: Record<string, Player>
	) {}
}

@CommandHandler( UpdateTurnCommand )
export class UpdateTurnCommandHandler implements ICommandHandler<UpdateTurnCommand, string> {

	private readonly logger = LoggerFactory.getLogger( UpdateTurnCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { currentMove, players }: UpdateTurnCommand ) {
		this.logger.debug( ">> executeUpdateTurnCommand()" );
		let nextTurn: string;

		switch ( currentMove.type ) {
			case MoveType.ASK_CARD: {
				this.logger.debug( "CurrentMove is ASK_MOVE!" );
				const { from, by } = currentMove.data as AskMoveData;
				if ( !currentMove.success ) {
					await this.prisma.literature.game.update( {
						where: { id: currentMove.gameId },
						data: { currentTurn: from }
					} );
					nextTurn = from;
				} else {
					nextTurn = by;
				}
				break;
			}

			case MoveType.CALL_SET: {
				this.logger.debug( "CurrentMoveType is CALL_SET!" );
				const { by } = currentMove.data as CallMoveData;
				const currentTeam = players[ by ].teamId;
				if ( !currentMove.success ) {
					const [ player ] = shuffle( Object.values( players )
						.filter( player => player.teamId !== currentTeam ) );

					await this.prisma.literature.game.update( {
						where: { id: currentMove.gameId },
						data: { currentTurn: player.id }
					} );

					nextTurn = player.id;
				} else {
					nextTurn = by;
				}
				break;
			}

			default: {
				this.logger.debug( "CurrentMoveType is TRANSFER_CHANCE!" );
				const { to } = currentMove.data as TransferMoveData;
				await this.prisma.literature.game.update( {
					where: { id: currentMove.gameId },
					data: { currentTurn: to }
				} );
				nextTurn = to;
				break;
			}
		}

		this.eventBus.publish( new TurnUpdatedEvent( nextTurn, currentMove.gameId ) );
		this.logger.debug( "Published TurnUpdatedEvent!" );

		this.logger.debug( "<< executeUpdateTurnCommand()" );
		return nextTurn;
	}
}