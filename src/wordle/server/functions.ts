"use server";

import { dictionary } from "@/libs/words/dictionary";
import { generateId } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { gameIdInput } from "@/shared/utils/validation";
import { createGameInputSchema, makeGuessInputSchema } from "@/wordle/server/inputs";
import { env } from "cloudflare:workers";
import { requestInfo } from "rwsdk/worker";
import { parseAsync } from "valibot";
import type { Wordle } from "../types";

const logger = createLogger( "Wordle:Functions" );

/**
 * Creates a new Wordle game.
 * Validates the input against the schema and
 * calls the durable object to create the game.
 *
 * @param {Wordle.CreateGameInput} input - The input for creating a game, including word count and length.
 * @returns {Promise<DataResponse<string>>} response containing the game data or an error message
 */
export async function createGame( input: Wordle.CreateGameInput ): Promise<DataResponse<string>> {
	const authInfo = requestInfo.ctx.authInfo!;

	await parseAsync( createGameInputSchema, input );

	const gameId = generateId();
	const durableObjectId = env.WORDLE_DURABLE_OBJECT.idFromName( gameId );

	const stub = env.WORDLE_DURABLE_OBJECT.get( durableObjectId );
	await stub.createGame( { ...input, gameId }, authInfo );
	return { data: gameId };
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
	await parseAsync( gameIdInput, { gameId } );
	const key = env.WORDLE_DURABLE_OBJECT.idFromName( gameId ).toString();
	const data = await env.WORDLE_KV.get( key ).then( d => d ? JSON.parse( d ) as Wordle.Game : null );
	return { data: data ?? undefined, error: !!data ? undefined : "Game not found" };
}

/**
 * Makes a guess in the Wordle game.
 * Validates the input against the schema and
 * calls the durable object to process the guess.
 *
 * @param {Wordle.MakeGuessInput} input - The input for making a guess, including game ID and guess word.
 * @returns {Promise<ErrorOnlyResponse>} response containing an error message
 */
export async function makeGuess( input: Wordle.MakeGuessInput ): Promise<ErrorOnlyResponse> {
	const authInfo = requestInfo.ctx.authInfo!;

	await parseAsync( makeGuessInputSchema, input );
	const durableObjectId = env.WORDLE_DURABLE_OBJECT.idFromName( input.gameId );
	const stub = env.WORDLE_DURABLE_OBJECT.get( durableObjectId );
	const data = await env.WORDLE_KV.get( durableObjectId.toString() )
		.then( d => d ? JSON.parse( d ) as Wordle.Game : null );

	if ( !data || data.playerId !== authInfo.id ) {
		logger.error( "Game Not Found!" );
		return { error: "Game not found!" };
	}

	if ( data.guesses.length >= data.wordLength + data.wordCount ) {
		logger.error( "No More Guesses Left! GameId: %s", data.id );
		return { error: "No more guesses left!" };
	}

	if ( !dictionary.includes( input.guess ) ) {
		logger.error( "The guess is not a valid word! GameId: %s", data.id );
		return { error: "The guess is not a valid word!" };
	}

	await stub.makeGuess( input );
	return { error: undefined };
}
