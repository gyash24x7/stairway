import { CommandHandler, type ICommand, type ICommandHandler } from "@nestjs/cqrs";
import { LoggerFactory } from "@shared/api";
import { dictionary } from "@stairway/words";
import { TRPCError } from "@trpc/server";
import { Messages } from "../wordle.constants.ts";
import { WordleRepository } from "../wordle.repository.ts";
import type { Game } from "../wordle.schema.ts";

export type MakeGuessInput = {
	gameId: string;
	guess: string;
}

export class MakeGuessCommand implements ICommand {
	constructor(
		public readonly input: MakeGuessInput,
		public readonly gameData: Game
	) {}
}

@CommandHandler( MakeGuessCommand )
export class MakeGuessCommandHandler implements ICommandHandler<MakeGuessCommand, Game> {

	private readonly logger = LoggerFactory.getLogger( MakeGuessCommandHandler );

	constructor( private readonly db: WordleRepository ) {}

	async execute( command: MakeGuessCommand ): Promise<Game> {
		this.logger.debug( ">> makeGuess()" );

		const { gameData, input } = await this.validate( command );

		if ( !gameData.completedWords.includes( input.guess ) && gameData.words.includes( input.guess ) ) {
			gameData.completedWords.push( input.guess );
		}

		gameData.guesses.push( input.guess );

		const [ game ] = await this.db.updateGame( gameData.id, gameData.guesses, gameData.completedWords );

		this.logger.debug( "<< makeGuess()" );
		return game;
	}

	async validate( { gameData, input }: MakeGuessCommand ) {
		this.logger.debug( ">> validateMakeGuessRequest()" );
		this.logger.debug( JSON.stringify( gameData ) );
		if ( gameData.guesses.length >= gameData.wordLength + gameData.wordCount ) {
			this.logger.error( "%s GameId: %s", Messages.GUESSES_EXHAUSTED, gameData.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.GUESSES_EXHAUSTED } );
		}

		if ( !dictionary.includes( input.guess ) ) {
			this.logger.error( "%s GameId: %s", Messages.INVALID_GUESS, gameData.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GUESS } );
		}

		this.logger.debug( "<< validateMakeGuessRequest()" );
		return { gameData, input };
	}

}