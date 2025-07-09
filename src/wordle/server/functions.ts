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
import * as v from "valibot";

const logger = createLogger( "Wordle:Functions" );

function getStub() {
	const durableObjectId = env.WORDLE_DURABLE_OBJECT.idFromName( "stairway" );
	return env.WORDLE_DURABLE_OBJECT.get( durableObjectId );
}

export async function createGame( input: CreateGameInput ) {
	const { issues, success } = await v.safeParseAsync( createGameInputSchema, input );
	if ( !success || !!issues ) {
		logger.error( "Invalid input for createGame", { issues, input } );
		return { error: issues, success: false as const };
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
	const { issues, success } = await v.safeParseAsync( gameIdInputSchema, { gameId } );
	if ( !success || !!issues ) {
		logger.error( "Invalid input for getGameData", { issues, gameId } );
		return { error: issues, success: false as const };
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
	const { issues, success } = await v.safeParseAsync( makeGuessInputSchema, input );
	if ( !success || !!issues ) {
		logger.error( "Invalid input for makeGuess", { issues, input } );
		return { error: issues, success: false as const };
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
