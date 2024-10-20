import "server-only";

import type { UserAuthInfo } from "@stairway/api/utils";
import { createLogger, prisma } from "@stairway/api/utils";
import { dictionary } from "@stairway/words";
import type { CreateGameInput, MakeGuessInput } from "./inputs.ts";
import type { Game } from "./types.ts";

const logger = createLogger( "WordleMutations" );

export async function getGameData( gameId: string ) {
	logger.debug( ">> getGameData()" );
	const data = await prisma.wordle.game.findUnique( { where: { id: gameId } } );
	logger.debug( "<< getGameData()" );
	return data;
}

export async function createGame(
	{ wordCount = 2, wordLength = 5 }: CreateGameInput,
	{ authInfo }: { authInfo: UserAuthInfo }
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

export async function makeGuess( input: MakeGuessInput, game: Game ) {
	logger.debug( ">> makeGuess()" );

	if ( game.guesses.length >= game.wordLength + game.wordCount ) {
		logger.error( "No More Guesses Left! GameId: %s", game.id );
		throw "No More Guesses Left!";
	}

	if ( !dictionary.includes( input.guess ) ) {
		logger.error( "The guess is not a valid word! GameId: %s", game.id );
		throw "The guess is not a valid word!";
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