"use server";

import {
	createGameInputSchema,
	declareDealWinsInputSchema,
	gameIdInputSchema,
	joinGameInputSchema,
	playCardInputSchema
} from "@/callbreak/server/inputs";
import type { Callbreak } from "@/callbreak/types";
import { createLogger } from "@/shared/utils/logger";
import { env } from "cloudflare:workers";
import { requestInfo } from "rwsdk/worker";
import { parseAsync } from "valibot";

const logger = createLogger( "Callbreak:Functions" );

function getStub() {
	const durableObjectId = env.CALLBREAK_DURABLE_OBJECT.idFromName( "stairway" );
	return env.CALLBREAK_DURABLE_OBJECT.get( durableObjectId );
}

/**
 * Creates a new Callbreak game.
 * Validates the input against the schema and
 * calls the durable object to create the game.
 *
 * @param {Callbreak.CreateGameInput} input - The input for creating a game, excluding authInfo.
 * @returns {Promise<DataResponse<string>>} - Returns an object containing the gameId or an error message.
 */
export async function createGame( input: Callbreak.CreateGameInput ): Promise<DataResponse<string>> {
	const stub = getStub();
	const authInfo = requestInfo.ctx.authInfo!;
	return parseAsync( createGameInputSchema, input )
		.then( () => stub.createGame( input, authInfo ) )
		.then( data => stub.saveGameData( data.game.id, data ) )
		.then( data => ( { data: data.game.id } ) )
		.catch( err => {
			logger.error( "Error creating game!", err );
			return { error: ( err as Error ).message };
		} );
}

/**
 * Joins an existing Callbreak game.
 * Validates the input against the schema and
 * calls the durable object to join the game.
 *
 * @param {Callbreak.JoinGameInput} input - The input for joining a game, including the game code.
 * @returns {Promise<DataResponse<string>>} - Returns an object containing the gameId or an error message.
 */
export async function joinGame( input: Callbreak.JoinGameInput ): Promise<DataResponse<string>> {
	const stub = getStub();
	const authInfo = requestInfo.ctx.authInfo!;
	return parseAsync( joinGameInputSchema, input )
		.then( () => stub.getGameByCode( input.code ) )
		.then( data => stub.validateJoinGame( data, authInfo ) )
		.then( data => stub.joinGame( data, authInfo ) )
		.then( data => stub.saveGameData( data.game.id, data ) )
		.then( data => ( { data: data.game.id } ) )
		.catch( err => {
			logger.error( "Error joining game!", err );
			return { error: ( err as Error ).message };
		} );
}

/**
 * Retrieves the game data for a specific Callbreak game.
 * Validates the input against the schema and
 * calls the durable object to get the game data.
 *
 * @param {Callbreak.GameIdInput} input - The input containing the gameId.
 * @returns {Promise<DataResponse<Callbreak.GameData>>} - Returns an object containing the game data or an error message.
 */
export async function getGameData( input: Callbreak.GameIdInput ): Promise<DataResponse<Callbreak.GameData>> {
	const stub = getStub();
	const authInfo = requestInfo.ctx.authInfo!;
	return parseAsync( gameIdInputSchema, input )
		.then( () => stub.getGameData( input.gameId, authInfo.id ) )
		.then( data => ( { data } ) )
		.catch( err => {
			logger.error( "Error getting game data!", err );
			return { error: ( err as Error ).message };
		} );
}

/**
 * Declares the deal wins for a specific Callbreak game.
 * Validates the input against the schema and
 * calls the durable object to declare the deal wins.
 *
 * @param {Callbreak.DeclareDealWinsInput} input - The input for declaring deal wins, including gameId and dealId.
 * @returns {Promise<ErrorOnlyResponse>} - Returns an object containing an error message if any.
 */
export async function declareDealWins( input: Callbreak.DeclareDealWinsInput ): Promise<ErrorOnlyResponse> {
	const stub = getStub();
	const authInfo = requestInfo.ctx.authInfo!;
	return parseAsync( declareDealWinsInputSchema, input )
		.then( () => stub.getGameData( input.gameId, authInfo.id ) )
		.then( data => stub.validateDealWinDeclaration( input, data, authInfo ) )
		.then( data => stub.declareDealWins( input, data ) )
		.then( data => stub.saveGameData( data.game.id, data ) )
		.then( () => ( { error: undefined } ) )
		.catch( err => {
			logger.error( "Error declaring deal wins!", err );
			return { error: ( err as Error ).message };
		} );
}

/**
 * Plays a card in a specific Callbreak game.
 * Validates the input against the schema and
 * calls the durable object to play the card.
 *
 * @param {Callbreak.PlayCardInput} input - The input for playing a card, including gameId, dealId, and roundId.
 * @returns {Promise<ErrorOnlyResponse>} - Returns an object containing an error message if any.
 */
export async function playCard( input: Callbreak.PlayCardInput ): Promise<ErrorOnlyResponse> {
	const stub = getStub();
	const authInfo = requestInfo.ctx.authInfo!;
	return parseAsync( playCardInputSchema, input )
		.then( () => stub.getGameData( input.gameId, authInfo.id ) )
		.then( data => stub.validatePlayCard( input, data, authInfo ) )
		.then( data => stub.playCard( input, data ) )
		.then( data => stub.saveGameData( data.game.id, data ) )
		.then( () => ( { error: undefined } ) )
		.catch( err => {
			logger.error( "Error playing card!", err );
			return { error: ( err as Error ).message };
		} );
}
