import type { CreateGameInput, GameData, User } from "@literature/types";
import type { ICommand, ICommandHandler } from "@nestjs/cqrs";
import { CommandHandler } from "@nestjs/cqrs";
import { generateGameCode } from "@s2h/cards";
import { LoggerFactory, PrismaService } from "@s2h/core";
import { GameDataTransformer } from "../transformers";

export class CreateGameCommand implements ICommand {
	constructor(
		public readonly input: CreateGameInput,
		public readonly authUser: User
	) {}
}

@CommandHandler( CreateGameCommand )
export class CreateGameCommandHandler implements ICommandHandler<CreateGameCommand, GameData> {

	private readonly logger = LoggerFactory.getLogger( CreateGameCommandHandler );

	constructor(
		private readonly prisma: PrismaService,
		private readonly transformer: GameDataTransformer
	) {}

	async execute( { input, authUser }: CreateGameCommand ) {
		this.logger.debug( ">> executeCreateGameCommand()" );

		const game = await this.prisma.literature.game.create( {
			data: {
				playerCount: input.playerCount,
				code: generateGameCode(),
				currentTurn: authUser.id
			}
		} );

		const player = await this.prisma.literature.player.create( {
			data: {
				id: authUser.id,
				name: authUser.name,
				avatar: authUser.avatar,
				gameId: game.id
			}
		} );

		this.logger.debug( "<< executeCreateGameCommand()" );
		return this.transformer.transform( { ...game, players: [ player ] } );
	}
}