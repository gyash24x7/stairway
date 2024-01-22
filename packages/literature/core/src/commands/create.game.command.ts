import { LoggerFactory } from "@common/core";
import type { CreateGameInput, User } from "@literature/data";
import { CommandHandler, ICommand, ICommandHandler } from "@nestjs/cqrs";
import { LiteratureService, LiteratureTransformers } from "../utils";

export class CreateGameCommand implements ICommand {
	constructor(
		public readonly input: CreateGameInput,
		public readonly authUser: User
	) {}
}

@CommandHandler( CreateGameCommand )
export class CreateGameCommandHandler implements ICommandHandler<CreateGameCommand> {

	private readonly logger = LoggerFactory.getLogger( CreateGameCommandHandler );

	constructor(
		private readonly service: LiteratureService,
		private readonly transformers: LiteratureTransformers
	) {}

	async execute( { input: { playerCount }, authUser: { id, name } }: CreateGameCommand ) {
		this.logger.log( ">> createGame()" );

		const game = await this.service.createGame( { playerCount, currentTurn: id } );
		const player = await this.service.createPlayer( { id, name, gameId: game.id } );
		const gameData = this.transformers.transformGameData( { ...game, players: [ player ] } );

		this.logger.debug( "<< createGame()" );
		return gameData;
	}
}
