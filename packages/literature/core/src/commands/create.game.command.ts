import type { UserAuthInfo } from "@auth/types";
import type { CreateGameInput, Game } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import { generateGameCode } from "@s2h/cards";
import { LoggerFactory, PrismaService } from "@s2h/core";

export class CreateGameCommand implements ICommand {
	constructor(
		public readonly input: CreateGameInput,
		public readonly authInfo: UserAuthInfo
	) {}
}

@CommandHandler( CreateGameCommand )
export class CreateGameCommandHandler implements ICommandHandler<CreateGameCommand, Game> {

	private readonly logger = LoggerFactory.getLogger( CreateGameCommandHandler );

	constructor( private readonly prisma: PrismaService ) {}

	async execute( { input, authInfo }: CreateGameCommand ) {
		this.logger.debug( ">> executeCreateGameCommand()" );

		const game = await this.prisma.literature.game.create( {
			data: {
				playerCount: input.playerCount,
				code: generateGameCode(),
				currentTurn: authInfo.id
			}
		} );

		await this.prisma.literature.player.create( {
			data: {
				id: authInfo.id,
				name: authInfo.name,
				avatar: authInfo.avatar,
				gameId: game.id,
				inferences: {}
			}
		} );

		this.logger.debug( "<< executeCreateGameCommand()" );
		return game;
	}
}