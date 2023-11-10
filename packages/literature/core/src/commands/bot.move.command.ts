import type { Player } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import { LoggerFactory, PrismaService } from "@s2h/core";

export class BotMoveCommand implements ICommand {
	constructor(
		public readonly gameId: string,
		public readonly player: Player
	) {}
}

@CommandHandler( BotMoveCommand )
export class BotMoveCommandHandler implements ICommandHandler<BotMoveCommand> {

	private readonly logger = LoggerFactory.getLogger( BotMoveCommandHandler );

	constructor(
		private readonly prisma: PrismaService
	) {}

	async execute( { gameId, player }: BotMoveCommand ) {
		this.logger.debug( ">> execute()" );

		await this.prisma.literature.inference.findUnique( {
			where: { gameId_playerId: { gameId, playerId: player.id } }
		} );

		this.logger.debug( "<< execute()" );
	}
}