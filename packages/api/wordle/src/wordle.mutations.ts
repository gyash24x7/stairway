import type { UserAuthInfo } from "@auth/api";
import { Injectable } from "@nestjs/common";
import { OgmaLogger, OgmaService } from "@ogma/nestjs-module";
import { dictionary } from "@stairway/words";
import { TRPCError } from "@trpc/server";
import type { Game } from "./index.ts";
import { Messages } from "./wordle.constants.ts";
import type { CreateGameInput, MakeGuessInput } from "./wordle.inputs.ts";
import { WordlePrisma } from "./wordle.prisma.ts";

@Injectable()
export class WordleMutations {

	constructor(
		private readonly prisma: WordlePrisma,
		@OgmaLogger( WordleMutations ) private readonly logger: OgmaService
	) {}

	async createGame( { wordCount = 2, wordLength = 5 }: CreateGameInput, { authInfo }: { authInfo: UserAuthInfo } ) {
		this.logger.log( ">> createGame()" );

		const words: string[] = [];
		for ( let i = 0; i < wordCount; i++ ) {
			words.push( dictionary[ Math.floor( Math.random() * dictionary.length ) ] );
		}

		const game = await this.prisma.game.create( {
			data: { playerId: authInfo.id, wordLength, wordCount, words }
		} );

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
		await this.prisma.game.update( {
			where: { id: game.id },
			data: { guesses: game.guesses, completedWords: game.completedWords }
		} );

		this.logger.debug( "<< makeGuess()" );
		return game;
	}
}