import { LoggerFactory } from "@common/core";
import { dictionary } from "@common/words";
import { CommandHandler, ICommand, type ICommandHandler } from "@nestjs/cqrs";
import { TRPCError } from "@trpc/server";
import type { Game, MakeGuessInput } from "@wordle/data";
import { Messages, WordleService } from "../utils";

export class MakeGuessCommand implements ICommand {
	constructor(
		public readonly input: MakeGuessInput,
		public readonly gameData: Game
	) {}
}

@CommandHandler( MakeGuessCommand )
export class MakeGuessCommandHandler implements ICommandHandler<MakeGuessCommand, Game> {

	private readonly logger = LoggerFactory.getLogger( MakeGuessCommandHandler );

	constructor( private readonly service: WordleService ) {}

	async execute( command: MakeGuessCommand ): Promise<Game> {
		this.logger.debug( ">> makeGuess()" );

		const { gameData, input } = await this.validate( command );

		if ( !gameData.completedWords.includes( input.guess ) && gameData.words.includes( input.guess ) ) {
			gameData.completedWords.push( input.guess );
		}

		gameData.guesses.push( input.guess );

		const [ game ] = await this.service.updateGame( gameData.id, gameData.guesses, gameData.completedWords );

		this.logger.debug( "<< makeGuess()" );
		return game;
	}

	async validate( { gameData, input }: MakeGuessCommand ) {
		this.logger.debug( ">> validateMakeGuessRequest()" );
		this.logger.debug( JSON.stringify( gameData ) );
		if ( gameData.guesses.length >= gameData.wordLength + gameData.wordCount ) {
			this.logger.error( "%s GameId: %s", Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS, gameData.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.GAME_ALREADY_HAS_REQUIRED_PLAYERS } );
		}

		if ( !dictionary.includes( input.guess ) ) {
			this.logger.error( "%s GameId: %s", Messages.NO_CARDS_WITH_RECEIVING_PLAYER, gameData.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.NO_CARDS_WITH_RECEIVING_PLAYER } );
		}

		this.logger.debug( "<< validateMakeGuessRequest()" );
		return { gameData, input };
	}

}