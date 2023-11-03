import type { GameData, GameStatus } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler, EventBus } from "@nestjs/cqrs";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { StatusUpdatedEvent } from "../events";

export class UpdateStatusCommand implements ICommand {
	constructor( public readonly gameData: GameData ) {}
}

@CommandHandler( UpdateStatusCommand )
export class UpdateStatusCommandHandler implements ICommandHandler<UpdateStatusCommand, GameStatus> {

	private readonly logger = LoggerFactory.getLogger( UpdateStatusCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly eventBus: EventBus
	) {}

	async execute( { gameData }: UpdateStatusCommand ) {
		this.logger.debug( ">> executeUpdateStatusCommand()" );

		await this.prisma.literature.game.update( {
			where: { id: gameData.id },
			data: { status: gameData.status }
		} );

		this.eventBus.publish( new StatusUpdatedEvent( gameData ) );
		this.logger.debug( "Published StatusUpdatedEvent!" );

		this.logger.debug( "<< executeUpdateStatusCommand()" );
		return gameData.status;
	}
}