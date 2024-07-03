import { LoggerFactory, type UserAuthInfo } from "@backend/utils";
import { CommandHandler, type ICommand, type ICommandHandler } from "@nestjs/cqrs";
import { LiteratureRepository } from "../literature.repository.ts";
import { type Game, type Player } from "../literature.types.ts";

export type CreateGameInput = {
	playerCount: number;
}

export class CreateGameCommand implements ICommand {
	constructor(
		public readonly input: CreateGameInput,
		public readonly authInfo: UserAuthInfo
	) {}
}

@CommandHandler( CreateGameCommand )
export class CreateGameCommandHandler implements ICommandHandler<CreateGameCommand, Game & { players: Player[] }> {

	private readonly logger = LoggerFactory.getLogger( CreateGameCommandHandler );

	constructor( private readonly repository: LiteratureRepository ) {}

	async execute( { input: { playerCount }, authInfo: { id, name, avatar } }: CreateGameCommand ) {
		this.logger.log( ">> createGame()" );

		const game = await this.repository.createGame( { playerCount, currentTurn: id } );
		const player = await this.repository.createPlayer( { id, name, gameId: game.id, avatar } );

		this.logger.debug( "<< createGame()" );
		return { ...game, players: [ player ] };
	}
}
