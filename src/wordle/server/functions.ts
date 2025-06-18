"use server";

import { createLogger } from "@/shared/utils/logger";
import {
	type CreateGameInput,
	createGameInputSchema,
	gameIdInputSchema,
	type MakeGuessInput,
	makeGuessInputSchema
} from "@/wordle/server/inputs";
import * as service from "@/wordle/server/service";
import { requestInfo } from "rwsdk/worker";

const logger = createLogger( "Auth:Functions" );

export async function createGame( input: CreateGameInput ) {
	const { error, success, data: parsedInput } = await createGameInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for createGame", { error, input } );
		return [ error.message, undefined ] as const;
	}

	try {
		const data = await service.createGame( parsedInput, requestInfo.ctx.authInfo! );
		return [ undefined, data ] as const;
	} catch ( err ) {
		logger.error( "Error creating game", { error: err, input } );
		return [ "Failed to create game. Please try again later.", undefined ] as const;
	}
}

export async function getGameData( gameId: string ) {
	const { error, success, data: parsedInput } = await gameIdInputSchema.safeParseAsync( { gameId } );
	if ( !success || !!error ) {
		logger.error( "Invalid input for getGameData", { error, gameId } );
		return [ error.message, undefined ] as const;
	}

	try {
		const data = await service.getGameData( parsedInput.gameId );
		return [ undefined, data ] as const;
	} catch ( err ) {
		logger.error( "Error fetching game data", { error: err, gameId } );
		return [ "Failed to fetch game data. Please try again later.", undefined ] as const;
	}
}

export async function makeGuess( input: MakeGuessInput ) {
	const { error, success, data: parsedInput } = await makeGuessInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for makeGuess", { error, input } );
		return [ error.message, undefined ] as const;
	}

	try {
		const data = await service.makeGuess( parsedInput );
		return [ undefined, data ] as const;
	} catch ( err ) {
		logger.error( "Error making guess", { error: err, input } );
		return [ "Failed to make guess. Please try again later.", undefined ] as const;
	}
}
