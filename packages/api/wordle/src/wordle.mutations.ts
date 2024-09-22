import { Injectable } from "@nestjs/common";
import { type AuthContext, LoggerFactory } from "@shared/api";
import { dictionary } from "@stairway/words";
import { TRPCError } from "@trpc/server";
import { Messages } from "./wordle.constants.ts";
import type { CreateGameInput, MakeGuessInput } from "./wordle.inputs.ts";
import { WordleRepository } from "./wordle.repository.ts";
import type { Game } from "./wordle.schema.ts";

@Injectable()
export class WordleMutations {

	private readonly logger = LoggerFactory.getLogger( WordleMutations );

	constructor( private readonly repository: WordleRepository ) {}

	async createGame( { wordCount = 2, wordLength = 5 }: CreateGameInput, { authInfo }: AuthContext ) {
		this.logger.log( ">> createGame()" );

		const words: string[] = [];
		for ( let i = 0; i < wordCount; i++ ) {
			words.push( dictionary[ Math.floor( Math.random() * dictionary.length ) ] );
		}

		const game = await this.repository.createGame( { playerId: authInfo.id, wordLength, wordCount, words } );

		this.logger.debug( "<< createGame()" );
		return game;
	}

	async makeGuess( input: MakeGuessInput, game: Game ) {
		this.logger.debug( ">> makeGuess()" );

		if ( game.guesses.length >= game.wordLength + game.wordCount ) {
			this.logger.error( "%s GameId: %s", Messages.GUESSES_EXHAUSTED, game.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.GUESSES_EXHAUSTED } );
		}

		if ( !dictionary.includes( input.guess ) ) {
			this.logger.error( "%s GameId: %s", Messages.INVALID_GUESS, game.id );
			throw new TRPCError( { code: "BAD_REQUEST", message: Messages.INVALID_GUESS } );
		}

		if ( !game.completedWords.includes( input.guess ) && game.words.includes( input.guess ) ) {
			game.completedWords.push( input.guess );
		}

		game.guesses.push( input.guess );
		await this.repository.updateGame( game.id, game.guesses, game.completedWords );

		this.logger.debug( "<< makeGuess()" );
		return game;
	}
}