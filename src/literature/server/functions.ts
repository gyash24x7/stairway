"use server";

import {
	askCardInputSchema,
	callSetInputSchema,
	createGameInputSchema,
	createTeamsInputSchema,
	joinGameInputSchema,
	transferTurnInputSchema
} from "@/literature/server/inputs";
import type { Literature } from "@/literature/types";
import { createLogger } from "@/shared/utils/logger";
import { gameIdInput } from "@/shared/utils/validation";
import { env } from "cloudflare:workers";
import { requestInfo } from "rwsdk/worker";
import { parseAsync } from "valibot";

const logger = createLogger( "Literature:Functions" );

function getStub() {
	const durableObjectId = env.LITERATURE_DURABLE_OBJECT.idFromName( "stairway" );
	return env.LITERATURE_DURABLE_OBJECT.get( durableObjectId );
}

/**
 * Creates a new game in the Literature application.
 * @param {Literature.CreateGameInput} input - The input data for creating a game
 * @returns {Promise<DataResponse<string>>} - A promise that resolves to the game ID or an error message
 */
export async function createGame( input: Literature.CreateGameInput ): Promise<DataResponse<string>> {
	const stub = getStub();
	return parseAsync( createGameInputSchema, input )
		.then( () => stub.createGame( input, requestInfo.ctx.authInfo! ) )
		.then( data => stub.saveGameData( data.game.id, data ) )
		.then( data => ( { data: data.game.id } ) )
		.catch( err => {
			logger.error( "Error creating game!", err );
			return { error: ( err as Error ).message };
		} );
}

/**
 * Joins an existing game in the Literature application.
 * @param {Literature.JoinGameInput} input - The input data for joining a game
 * @returns {Promise<DataResponse<string>>} - A promise that resolves to the game ID or an error message
 */
export async function joinGame( input: Literature.JoinGameInput ): Promise<DataResponse<string>> {
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
 * Retrieves the game data for a specific game in the Literature application.
 * @param {Literature.GameIdInput} input - The input data containing the game ID
 * @returns {Promise<DataResponse<Literature.Store>} - A promise that resolves to the game data or an error message
 */
export async function getGameData( input: Literature.GameIdInput ): Promise<DataResponse<Literature.Store>> {
	const stub = getStub();
	const authInfo = requestInfo.ctx.authInfo!;
	return parseAsync( gameIdInput, input )
		.then( () => stub.getGameStore( input.gameId, authInfo ) )
		.then( data => ( { data } ) )
		.catch( err => {
			logger.error( "Error getting game data!", err );
			return { error: ( err as Error ).message };
		} );
}

/**
 * Adds bots to a game in the Literature application.
 * @param {Literature.GameIdInput} input - The input data containing the game ID
 * @returns {Promise<ErrorOnlyResponse>} - A promise that resolves to an error message if any error occurs
 */
export async function addBots( input: Literature.GameIdInput ): Promise<ErrorOnlyResponse> {
	const stub = getStub();
	return parseAsync( gameIdInput, input )
		.then( () => stub.getGameData( input.gameId ) )
		.then( data => stub.validateAddBots( data ) )
		.then( data => stub.addBots( data ) )
		.then( data => stub.saveGameData( data.game.id, data ) )
		.then( () => ( { error: undefined } ) )
		.catch( err => {
			logger.error( "Error adding bots!", err );
			return { error: ( err as Error ).message };
		} );
}

/**
 * Creates teams for a game in the Literature application.
 * @param {Literature.CreateTeamsInput} input - The input data for creating teams
 * @returns {Promise<ErrorOnlyResponse>} - A promise that resolves to an error message if any error occurs
 */
export async function createTeams( input: Literature.CreateTeamsInput ): Promise<ErrorOnlyResponse> {
	const stub = getStub();
	return parseAsync( createTeamsInputSchema, input )
		.then( () => stub.getGameData( input.gameId ) )
		.then( data => stub.validateCreateTeams( data ) )
		.then( data => stub.createTeams( input, data ) )
		.then( data => stub.saveGameData( data.game.id, data ) )
		.then( () => ( { error: undefined } ) )
		.catch( err => {
			logger.error( "Error creating teams!", err );
			return { error: ( err as Error ).message };
		} );
}

/**
 * Starts a game in the Literature application.
 * @param {Literature.GameIdInput} input - The input data containing the game ID
 * @returns {Promise<ErrorOnlyResponse>} - A promise that resolves to an error message if any error occurs
 */
export async function startGame( input: Literature.GameIdInput ): Promise<ErrorOnlyResponse> {
	const stub = getStub();
	return parseAsync( gameIdInput, input )
		.then( () => stub.getGameData( input.gameId ) )
		.then( data => stub.validateStartGame( data ) )
		.then( data => stub.startGame( data ) )
		.then( data => stub.saveGameData( data.game.id, data ) )
		.then( () => ( { error: undefined } ) )
		.catch( err => {
			logger.error( "Error starting game!", err );
			return { error: ( err as Error ).message };
		} );
}

/**
 * Asks a card in the Literature application.
 * @param {Literature.AskCardInput} input - The input data for asking a card
 * @returns {Promise<ErrorOnlyResponse>} - A promise that resolves to an error message if any error occurs
 */
export async function askCard( input: Literature.AskCardInput ): Promise<ErrorOnlyResponse> {
	const stub = getStub();
	return parseAsync( askCardInputSchema, input )
		.then( () => stub.getGameData( input.gameId ) )
		.then( data => stub.validateAskCard( input, data ) )
		.then( data => stub.askCard( input, data ) )
		.then( data => stub.saveGameData( data.game.id, data ) )
		.then( () => ( { error: undefined } ) )
		.catch( err => {
			logger.error( "Error asking card!", err );
			return { error: ( err as Error ).message };
		} );
}

/**
 * Calls a set in the Literature application.
 * @param {Literature.CallSetInput} input - The input data for calling a set
 * @returns {Promise<ErrorOnlyResponse>} - A promise that resolves to an error message if any error occurs
 */
export async function callSet( input: Literature.CallSetInput ): Promise<ErrorOnlyResponse> {
	const stub = getStub();
	return parseAsync( callSetInputSchema, input )
		.then( () => stub.getGameData( input.gameId ) )
		.then( data => stub.validateCallSet( input, data ) )
		.then( data => stub.callSet( input, data ) )
		.then( data => stub.saveGameData( data.game.id, data ) )
		.then( () => ( { error: undefined } ) )
		.catch( err => {
			logger.error( "Error calling set!", err );
			return { error: ( err as Error ).message };
		} );
}

/**
 * Transfers the turn in the Literature application.
 * @param {Literature.TransferTurnInput} input - The input data for transferring the turn
 * @returns {Promise<ErrorOnlyResponse>} - A promise that resolves to an error message if any error occurs
 */
export async function transferTurn( input: Literature.TransferTurnInput ): Promise<ErrorOnlyResponse> {
	const stub = getStub();
	return parseAsync( transferTurnInputSchema, input )
		.then( () => stub.getGameData( input.gameId ) )
		.then( data => stub.validateTransferTurn( input, data ) )
		.then( data => stub.transferTurn( input, data ) )
		.then( data => stub.saveGameData( data.game.id, data ) )
		.then( () => ( { error: undefined } ) )
		.catch( err => {
			logger.error( "Error transferring turn!", err );
			return { error: ( err as Error ).message };
		} );
}

/**
 * Executes a bot move in the Literature application.
 * @param {Literature.GameIdInput} input - The input data containing the game ID
 * @returns {Promise<ErrorOnlyResponse>} - A promise that resolves to an error message if any error occurs
 */
export async function executeBotMove( input: Literature.GameIdInput ): Promise<ErrorOnlyResponse> {
	const stub = getStub();
	return parseAsync( gameIdInput, input )
		.then( () => stub.getGameData( input.gameId ) )
		.then( data => stub.validateExecuteBotMove( data ) )
		.then( data => stub.executeBotMove( data ) )
		.then( data => stub.saveGameData( data.game.id, data ) )
		.then( () => ( { error: undefined } ) )
		.catch( err => {
			logger.error( "Error executing bot move!", err );
			return { error: ( err as Error ).message };
		} );
}