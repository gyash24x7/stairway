"use server";

import { createLogger } from "@/shared/utils/logger";
import {
	type CreateGameInput,
	createGameInputSchema,
	gameIdInputSchema,
	type MakeGuessInput,
	makeGuessInputSchema
} from "@/wordle/server/inputs";
import { env } from "cloudflare:workers";
import { requestInfo } from "rwsdk/worker";

const logger = createLogger( "Wordle:Functions" );

function getStub() {
	const durableObjectId = env.WORDLE_DURABLE_OBJECT.idFromName( "stairway" );
	return env.WORDLE_DURABLE_OBJECT.get( durableObjectId );
}

export async function createGame( input: CreateGameInput ) {
	const { error, success } = await createGameInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for createGame", { error, input } );
		return { error: error.message, success: false as const };
	}

	try {
		const stub = getStub();
		const { id } = await stub.createGame( input, requestInfo.ctx.authInfo! );
		return { data: id, success: true as const };
	} catch ( err ) {
		logger.error( "Error creating game", { error: err, input } );
		return { error: "Failed to create game. Please try again later.", success: false as const };
	}
}

export async function getGameData( gameId: string ) {
	const { error, success } = await gameIdInputSchema.safeParseAsync( { gameId } );
	if ( !success || !!error ) {
		logger.error( "Invalid input for getGameData", { error, gameId } );
		return { error: error.message, success: false as const };
	}

	try {
		const stub = getStub();
		const data = await stub.getGameData( gameId );
		if ( !data ) {
			logger.warn( "Game not found!" );
			return { error: "Game not found!", success: false as const };
		}

		return {
			success: true as const,
			data: {
				id: data.id,
				playerId: data.playerId,
				wordCount: data.wordCount,
				wordLength: data.wordLength,
				words: data.words,
				guesses: data.guesses,
				completedWords: data.completedWords
			}
		};
	} catch ( err ) {
		logger.error( "Error fetching game data", { error: err, gameId } );
		return { error: "Failed to fetch game data. Please try again later.", success: false as const };
	}
}

export async function makeGuess( input: MakeGuessInput ) {
	const { error, success } = await makeGuessInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for makeGuess", { error, input } );
		return { error: error.message, success: false as const };
	}

	try {
		const stub = getStub();
		await stub.makeGuess( input, requestInfo.ctx.authInfo!.id );
		return { success: true as const };
	} catch ( err ) {
		logger.error( "Error making guess", { error: err, input } );
		return { error: "Failed to make guess. Please try again later.", success: false as const };
	}
}
