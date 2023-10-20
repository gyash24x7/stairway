import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import type { CreateGameInput } from "@literature/data";
import type { UserAuthInfo } from "@auth/data";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { generateGameCode } from "@s2h/cards";

export class CreateGameCommand implements ICommand {
	constructor(
		public readonly input: CreateGameInput,
		public readonly authInfo: UserAuthInfo
	) {}
}

@CommandHandler( CreateGameCommand )
export class CreateGameCommandHandler implements ICommandHandler<CreateGameCommand, string> {

	private readonly logger = LoggerFactory.getLogger( CreateGameCommandHandler );

	constructor( private readonly prisma: PrismaService ) {}

	async execute( { input, authInfo }: CreateGameCommand ) {
		this.logger.debug( ">> execute()" );

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
				gameId: game.id
			}
		} );

		return game.id;
	}
}