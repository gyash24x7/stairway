import { LoggerFactory, type User } from "@common/core";
import { dictionary } from "@common/words";
import { CommandHandler, ICommand, ICommandHandler } from "@nestjs/cqrs";
import type { CreateGameInput, Game } from "@wordle/data";
import { WordleService } from "../utils";

export class CreateGameCommand implements ICommand {
	constructor(
		public readonly input: CreateGameInput,
		public readonly authUser: User
	) {}
}

@CommandHandler( CreateGameCommand )
export class CreateGameCommandHandler implements ICommandHandler<CreateGameCommand, Game> {

	private readonly logger = LoggerFactory.getLogger( CreateGameCommandHandler );

	constructor( private readonly service: WordleService ) {}

	async execute( { input: { wordCount = 1, wordLength }, authUser: { id } }: CreateGameCommand ) {
		this.logger.log( ">> createGame()" );

		const words: string[] = [];
		for ( let i = 0; i < wordCount; i++ ) {
			words.push( dictionary[ Math.floor( Math.random() * dictionary.length ) ] );
		}

		const game = await this.service.createGame( { playerId: id, wordLength, wordCount, words } );

		this.logger.debug( "<< createGame()" );
		return game;
	}
}
