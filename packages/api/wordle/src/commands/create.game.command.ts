import { CommandHandler, type ICommand, type ICommandHandler } from "@nestjs/cqrs";
import { LoggerFactory, type UserAuthInfo } from "@shared/api";
import { dictionary } from "@stairway/words";
import { WordleRepository } from "../wordle.repository.ts";
import type { Game } from "../wordle.schema.ts";

export type CreateGameInput = {
	wordCount?: number;
	wordLength?: number;
}

export class CreateGameCommand implements ICommand {
	constructor(
		public readonly input: CreateGameInput,
		public readonly authInfo: UserAuthInfo
	) {}
}

@CommandHandler( CreateGameCommand )
export class CreateGameCommandHandler implements ICommandHandler<CreateGameCommand, Game> {

	private readonly logger = LoggerFactory.getLogger( CreateGameCommandHandler );

	constructor( private readonly repository: WordleRepository ) {}

	async execute( { input: { wordCount = 1, wordLength = 5 }, authInfo: { id } }: CreateGameCommand ) {
		this.logger.log( ">> createGame()" );

		const words: string[] = [];
		for ( let i = 0; i < wordCount; i++ ) {
			words.push( dictionary[ Math.floor( Math.random() * dictionary.length ) ] );
		}

		const game = await this.repository.createGame( { playerId: id, wordLength, wordCount, words } );

		this.logger.debug( "<< createGame()" );
		return game;
	}
}
