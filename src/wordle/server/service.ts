import type { AuthInfo } from "@/auth/types";
import { dictionary } from "@/libs/words/dictionary";
import { getDb } from "@/shared/db";
import { createLogger } from "@/shared/utils/logger";
import * as schema from "@/wordle/schema";
import type { CreateGameInput, MakeGuessInput } from "@/wordle/server/inputs";
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";

const logger = createLogger( "WordleMutations" );

export async function getGameData( gameId: string ) {
	logger.debug( ">> getGameData()" );
	const db = await getDb();
	const [ game ] = await db.select().from( schema.games ).where( eq( schema.games.id, gameId ) );
	logger.debug( "<< getGameData()" );
	return game;
}

export async function createGame(
	{ wordCount = 2, wordLength = 5 }: CreateGameInput,
	authInfo: AuthInfo
) {
	logger.debug( ">> createGame()" );
	const db = await getDb();

	const words: string[] = [];
	for ( let i = 0; i < wordCount; i++ ) {
		words.push( dictionary[ Math.floor( Math.random() * dictionary.length ) ] );
	}

	const [ game ] = await db.insert( schema.games )
		.values( { playerId: authInfo.id, wordLength, wordCount, words: words.join( "," ) } )
		.returning();

	logger.debug( "<< createGame()" );
	return game;
}

export async function makeGuess( input: MakeGuessInput ) {
	logger.debug( ">> makeGuess()" );
	const db = await getDb();

	const [ game ] = await db.select().from( schema.games ).where( eq( schema.games.id, input.gameId ) );
	if ( !game ) {
		logger.error( "Game Not Found!" );
		throw new ORPCError( "NOT_FOUND", { message: "Game not found!" } );
	}

	const words = game.words ? game.words.split( "," ) : [];
	const guesses = game.guesses ? game.guesses.split( "," ) : [];
	const completedWords = game.completedWords ? game.completedWords.split( "," ) : [];

	if ( guesses.length >= game.wordLength + game.wordCount ) {
		logger.error( "No More Guesses Left! GameId: %s", game.id );
		throw new ORPCError( "BAD_REQUEST", { message: "No More Guesses Left!" } );
	}

	if ( !dictionary.includes( input.guess ) ) {
		logger.error( "The guess is not a valid word! GameId: %s", game.id );
		throw new ORPCError( "BAD_REQUEST", { message: "The guess is not a valid word!" } );
	}

	if ( !completedWords.includes( input.guess ) && words.includes( input.guess ) ) {
		completedWords.push( input.guess );
	}

	guesses.push( input.guess );
	await db.update( schema.games )
		.set( { guesses: guesses.join( "," ), completedWords: completedWords.join( "," ) } )
		.where( eq( schema.games.id, game.id ) );

	logger.debug( "<< makeGuess()" );
	return { ...game, guesses: guesses.join( "," ), completedWords: completedWords.join( "," ) };
}