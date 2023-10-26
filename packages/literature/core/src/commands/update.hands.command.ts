import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type { AskMoveData, CallMoveData, CardMappingData, HandData, Move } from "@literature/types";
import { MoveType } from "@literature/types";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { buildHandData } from "../utils";
import { HandsUpdatedEvent } from "../events";

export class UpdateHandsCommand implements ICommand {
	constructor(
		public readonly currentMove: Move,
		public readonly cardMappings: CardMappingData
	) {}
}

@CommandHandler( UpdateHandsCommand )
export class UpdateHandsCommandHandler implements ICommandHandler<UpdateHandsCommand, HandData> {

	private readonly logger = LoggerFactory.getLogger( UpdateHandsCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { cardMappings, currentMove }: UpdateHandsCommand ) {
		this.logger.debug( ">> executeUpdateHandsCommand()" );

		let hasCardTransferHappened = false;

		switch ( currentMove.type ) {
			case MoveType.ASK_CARD:
				const { card, by } = currentMove.data as AskMoveData;
				if ( currentMove.success ) {
					await this.prisma.literature.cardMapping.update( {
						where: { cardId_gameId: { gameId: currentMove.gameId, cardId: card } },
						data: { playerId: by }
					} );

					cardMappings[ card ] = by;
					hasCardTransferHappened = true;
				}
				break;

			case MoveType.CALL_SET:
				const { correctCall } = currentMove.data as CallMoveData;
				const calledCards = Object.keys( correctCall );
				await this.prisma.literature.cardMapping.deleteMany( {
					where: { cardId: { in: calledCards } }
				} );

				calledCards.map( cardId => {
					delete cardMappings[ cardId ];
				} );

				hasCardTransferHappened = true;
				break;
		}

		const updatedHands = buildHandData( cardMappings );

		if ( hasCardTransferHappened ) {
			this.eventBus.publish( new HandsUpdatedEvent( updatedHands, currentMove.gameId ) );
			this.logger.debug( "Published HandsUpdatedEvent!" );
		}

		this.logger.debug( "<< executeUpdateHandsCommand()" );
		return updatedHands;
	}
}