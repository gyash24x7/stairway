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

export async function createGame( input: Literature.CreateGameInput ) {
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

export async function joinGame( input: Literature.JoinGameInput ) {
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

export async function getGameData( input: Literature.GameIdInput ) {
	const stub = getStub();
	return parseAsync( gameIdInput, input )
		.then( () => stub.getGameData( input.gameId ) )
		.then( data => ( { data } ) )
		.catch( err => {
			logger.error( "Error getting game data!", err );
			return { error: ( err as Error ).message };
		} );
}

export async function addBots( input: Literature.GameIdInput ) {
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

export async function createTeams( input: Literature.CreateTeamsInput ) {
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

export async function startGame( input: Literature.GameIdInput ) {
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

export async function askCard( input: Literature.AskCardInput ) {
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

export async function callSet( input: Literature.CallSetInput ) {
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

export async function transferTurn( input: Literature.TransferTurnInput ) {
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

export async function executeBotMove( input: Literature.GameIdInput ) {
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