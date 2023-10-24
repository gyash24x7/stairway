import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import type { GameStatus } from "@literature/types";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { StatusUpdatedEvent } from "../events";

export class UpdateStatusCommand implements ICommand {
	constructor(
		public readonly gameId: string,
		public readonly status: GameStatus
	) {}
}

@CommandHandler( UpdateStatusCommand )
export class UpdateStatusCommandHandler implements ICommandHandler<UpdateStatusCommand, GameStatus> {

	private readonly logger = LoggerFactory.getLogger( UpdateStatusCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { gameId, status }: UpdateStatusCommand ) {
		this.logger.debug( ">> executeUpdateStatusCommand()" );

		await this.prisma.literature.game.update( {
			where: { id: gameId },
			data: { status }
		} );

		this.eventBus.publish( new StatusUpdatedEvent( gameId, status ) );
		this.logger.debug( "Published StatusUpdatedEvent!" );

		this.logger.debug( "<< executeUpdateStatusCommand()" );
		return status;
	}
}