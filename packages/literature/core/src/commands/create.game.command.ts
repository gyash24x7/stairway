import { LoggerFactory, type User } from "@common/core";
import type { CreateGameInput, GameData } from "@literature/data";
import { CommandHandler, ICommand, ICommandHandler } from "@nestjs/cqrs";
import { DatabaseService } from "../services";
import { transformGameData } from "../utils";

export class CreateGameCommand implements ICommand {
	constructor(
		public readonly input: CreateGameInput,
		public readonly authUser: User
	) {}
}

@CommandHandler( CreateGameCommand )
export class CreateGameCommandHandler implements ICommandHandler<CreateGameCommand, GameData> {

	private readonly logger = LoggerFactory.getLogger( CreateGameCommandHandler );

	constructor( private readonly db: DatabaseService ) {}

	async execute( { input: { playerCount }, authUser: { id, name, avatar } }: CreateGameCommand ) {
		this.logger.log( ">> createGame()" );

		const game = await this.db.createGame( { playerCount, currentTurn: id } );
		const player = await this.db.createPlayer( { id, name, gameId: game.id, avatar } );
		const gameData = transformGameData( { ...game, players: [ player ] } );

		this.logger.debug( "<< createGame()" );
		return gameData;
	}
}
