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
	const { error, success } = await createGameInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for createGame", { error, input } );
		return { error: error.message, data: undefined };
	}

	try {
		const data = await service.createGame( input, requestInfo.ctx.authInfo! );
		return { error: undefined, data };
	} catch ( err ) {
		logger.error( "Error creating game", { error: err, input } );
		return { error: "Failed to create game. Please try again later.", data: undefined };
	}
}

export async function getGameData( gameId: string ) {
	const { error, success } = await gameIdInputSchema.safeParseAsync( { gameId } );
	if ( !success || !!error ) {
		logger.error( "Invalid input for getGameData", { error, gameId } );
		return { error: error.message, data: undefined };
	}

	try {
		const data = await service.getGameData( gameId );
		return { error: undefined, data };
	} catch ( err ) {
		logger.error( "Error fetching game data", { error: err, gameId } );
		return { error: "Failed to fetch game data. Please try again later.", data: undefined };
	}
}

export async function makeGuess( input: MakeGuessInput ) {
	const { error, success } = await makeGuessInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for makeGuess", { error, input } );
		return { error: error.message, data: undefined };
	}

	try {
		const data = await service.makeGuess( input );
		return { error: undefined, data };
	} catch ( err ) {
		logger.error( "Error making guess", { error: err, input } );
		return { error: "Failed to make guess. Please try again later.", data: undefined };
	}
}
