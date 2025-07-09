"use server";

import { createLogger } from "@/shared/utils/logger";
import { gameIdInput } from "@/shared/utils/validation";
import { createGameInputSchema, makeGuessInputSchema } from "@/wordle/server/inputs";
import { env } from "cloudflare:workers";
import { requestInfo } from "rwsdk/worker";
import { parseAsync } from "valibot";
import type { Wordle } from "../types";

const logger = createLogger( "Wordle:Functions" );

function getStub() {
	const durableObjectId = env.WORDLE_DURABLE_OBJECT.idFromName( "stairway" );
	return env.WORDLE_DURABLE_OBJECT.get( durableObjectId );
}

/**
 * Creates a new Wordle game.
 * Validates the input against the schema and
 * calls the durable object to create the game.
 *
 * @param {Wordle.CreateGameInput} input - The input for creating a game, including word count and length.
 * @returns {Promise<DataResponse<Wordle.Game>>} response containing the game data or an error message
 */
export async function createGame( input: Wordle.CreateGameInput ): Promise<DataResponse<Wordle.Game>> {
	const stub = getStub();
	const authInfo = requestInfo.ctx.authInfo!;
	return parseAsync( createGameInputSchema, input )
		.then( () => stub.createGame( input, authInfo ) )
		.then( data => stub.saveGameData( data.id, data ) )
		.then( data => ( { data } ) )
		.catch( err => {
			logger.error( "Error creating game!", err );
			return { error: ( err as Error ).message, success: false as const };
		} );
}

/**
 * Fetches game data for a given game ID.
 * Validates the game ID against the schema and
 * calls the durable object to retrieve the game data.
 *
 * @param {string} gameId - The ID of the game to fetch data for.
 * @returns {Promise<DataResponse<Wordle.Game>>} response containing the game data or an error message
 * */
export async function getGameData( gameId: string ): Promise<DataResponse<Wordle.Game>> {
	const stub = getStub();
	return parseAsync( gameIdInput, { gameId } )
		.then( () => stub.getGameData( gameId ) )
		.then( data => ( { data } ) )
		.catch( err => {
			logger.error( "Error fetching game data", { error: err, gameId } );
			return { error: "Failed to fetch game data. Please try again later.", success: false as const };
		} );
}

/**
 * Makes a guess in the Wordle game.
 * Validates the input against the schema and
 * calls the durable object to process the guess.
 *
 * @param {Wordle.MakeGuessInput} input - The input for making a guess, including game ID and guess word.
 * @returns {Promise<DataResponse<Wordle.Game>>} response containing the updated game data or an error message
 */
export async function makeGuess( input: Wordle.MakeGuessInput ): Promise<DataResponse<Wordle.Game>> {
	const stub = getStub();
	const authInfo = requestInfo.ctx.authInfo!;
	return parseAsync( makeGuessInputSchema, input )
		.then( () => stub.makeGuess( input, authInfo.id ) )
		.then( data => stub.saveGameData( data.id, data ) )
		.then( data => ( { data } ) )
		.catch( err => {
			logger.error( "Error making guess!", err );
			return { error: ( err as Error ).message, success: false as const };
		} );
}
