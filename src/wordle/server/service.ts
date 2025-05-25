import type { AuthInfo } from "@/auth/types";
import { dictionary } from "@/shared/words/dictionary";
import { createLogger } from "@/shared/utils/logger";
import { prisma } from "@/shared/utils/prisma";
import type { CreateGameInput, MakeGuessInput } from "@/wordle/server/inputs";
import { ORPCError } from "@orpc/server";

const logger = createLogger( "WordleMutations" );

export async function getGameData( gameId: string ) {
	logger.debug( ">> getGameData()" );
	const data = await prisma.wordle.game.findUnique( { where: { id: gameId } } );
	logger.debug( "<< getGameData()" );
	return data;
}

export async function createGame(
	{ wordCount = 2, wordLength = 5 }: CreateGameInput,
	authInfo: AuthInfo
) {
	logger.debug( ">> createGame()" );

	const words: string[] = [];
	for ( let i = 0; i < wordCount; i++ ) {
		words.push( dictionary[ Math.floor( Math.random() * dictionary.length ) ] );
	}

	const game = await prisma.wordle.game.create( {
		data: { playerId: authInfo.id, wordLength, wordCount, words }
	} );

	logger.debug( "<< createGame()" );
	return game;
}

export async function makeGuess( input: MakeGuessInput ) {
	logger.debug( ">> makeGuess()" );

	const game = await prisma.wordle.game.findUnique( { where: { id: input.gameId } } );

	if ( !game ) {
		logger.error( "Game Not Found!" );
		throw new ORPCError( "NOT_FOUND", { message: "Game not found!" } );
	}

	if ( game.guesses.length >= game.wordLength + game.wordCount ) {
		logger.error( "No More Guesses Left! GameId: %s", game.id );
		throw new ORPCError( "BAD_REQUEST", { message: "No More Guesses Left!" } );
	}

	if ( !dictionary.includes( input.guess ) ) {
		logger.error( "The guess is not a valid word! GameId: %s", game.id );
		throw new ORPCError( "BAD_REQUEST", { message: "The guess is not a valid word!" } );
	}

	if ( !game.completedWords.includes( input.guess ) && game.words.includes( input.guess ) ) {
		game.completedWords.push( input.guess );
	}

	game.guesses.push( input.guess );
	await prisma.wordle.game.update( {
		where: { id: game.id },
		data: { guesses: game.guesses, completedWords: game.completedWords }
	} );

	logger.debug( "<< makeGuess()" );
	return game;
}