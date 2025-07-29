"use server";

import {
	askCardInputSchema,
	callSetInputSchema,
	createGameInputSchema,
	createTeamsInputSchema,
	joinGameInputSchema,
	transferTurnInputSchema
} from "@/fish/server/inputs";
import {
	validateAddPlayer,
	validateAskEvent,
	validateClaimEvent,
	validateCreateTeams,
	validateStartGame,
	validateTransferTurn
} from "@/fish/server/validations";
import type {
	AskEventInput,
	ClaimEventInput,
	CreateGameInput,
	CreateTeamsInput,
	FishGameData,
	FishPlayerGameInfo,
	GameIdInput,
	JoinGameInput,
	StartGameInput,
	TransferEventInput
} from "@/libs/fish/types";
import { generateId } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { gameIdInput } from "@/shared/utils/validation";
import { env } from "cloudflare:workers";
import { requestInfo } from "rwsdk/worker";
import { parseAsync } from "valibot";

const logger = createLogger( "Fish:Functions" );

async function getWorkflow( gameId: string ) {
	const instanceId = await env.FISH_KV.get( `workflow_${ gameId }` );
	if ( !instanceId ) {
		logger.error( "Workflow not found for game ID:", gameId );
		throw "Workflow not found";
	}

	return env.FISH_WORKFLOW.get( instanceId );
}

async function getGameData( gameId: string ): Promise<FishGameData> {
	const data = await env.FISH_KV.get( gameId ).then( d => !d ? null : JSON.parse( d ) );
	if ( !data ) {
		logger.error( "Game not found for ID:", gameId );
		throw "Game not found";
	}
	return data;
}

/**
 * Create a new Fish game.
 * @param {CreateGameInput} input - The input for creating a new game.
 * @returns {Promise<DataResponse<string>>} - A DataResponse containing the game ID or an error message.
 */
export async function createGame( input: CreateGameInput ): Promise<DataResponse<string>> {
	const authInfo = requestInfo.ctx.authInfo!;
	try {
		await parseAsync( createGameInputSchema, input );
		input.gameId = generateId();
		input.playerId = authInfo.id;
		await env.FISH_WORKFLOW.create( { params: input } );
		return { data: input.gameId };
	} catch ( err ) {
		logger.error( "Error creating game!", err );
		return { error: ( err as Error ).message };
	}
}

/**
 * Join an existing Fish game.
 * @param {JoinGameInput} input - The input for joining a game.
 * @returns {Promise<DataResponse<string>>} - A DataResponse containing the game ID or an error message.
 */
export async function joinGame( input: JoinGameInput ): Promise<DataResponse<string>> {
	const authInfo = requestInfo.ctx.authInfo!;
	try {
		await parseAsync( joinGameInputSchema, input );

		const gameId = await env.FISH_KV.get( `code_${ input.code }` );
		if ( !gameId ) {
			logger.error( "Game not found for code:", input.code );
			return { error: "Game not found" };
		}

		const data = await getGameData( gameId );
		const isAlreadyPartOfGame = validateAddPlayer( data, authInfo.id );
		if ( isAlreadyPartOfGame ) {
			logger.debug( "Player already part of the game, returning existing game ID." );
			return { data: gameId };
		}

		const workflow = await getWorkflow( gameId );
		await workflow.sendEvent( { type: "join-game", payload: authInfo } );
		return { data: gameId };
	} catch ( err ) {
		logger.error( "Error joining game!", err );
		return { error: ( err as Error ).message };
	}
}

/**
 * Get the game data for a specific Fish game.
 * @param {GameIdInput} input - The input containing the game ID.
 * @returns {Promise<DataResponse<FishPlayerGameInfo>>} - A DataResponse containing the game data or an error message.
 */
export async function getGameStore( input: GameIdInput ): Promise<DataResponse<FishPlayerGameInfo>> {
	const { id: playerId } = requestInfo.ctx.authInfo!;
	try {
		await parseAsync( gameIdInput, input );
		const { hands, cardMappings, ...rest } = await getGameData( input.gameId );
		return { data: { ...rest, playerId, hand: hands[ playerId ] || [] } };
	} catch ( err ) {
		logger.error( "Error getting game data!", err );
		return { error: ( err as Error ).message };
	}
}

/**
 * Create teams for a Fish game.
 * @param {CreateTeamsInput} input - The input containing the game ID and team information.
 * @returns {Promise<ErrorOnlyResponse>} - An ErrorOnlyResponse indicating success or failure.
 */
export async function createTeams( input: CreateTeamsInput ): Promise<ErrorOnlyResponse> {
	const authInfo = requestInfo.ctx.authInfo!;
	try {
		await parseAsync( createTeamsInputSchema, input );
		const data = await getGameData( input.gameId );
		validateCreateTeams( input, data, authInfo.id );

		const workflow = await getWorkflow( input.gameId );
		await workflow.sendEvent( { type: "create-teams", payload: input } );
		return { error: undefined };
	} catch ( err ) {
		logger.error( "Error creating teams!", err );
		return { error: ( err as Error ).message };
	}
}

/**
 * Start a Fish game.
 * @param {StartGameInput} input - The input containing the game ID.
 * @returns {Promise<ErrorOnlyResponse>} - An ErrorOnlyResponse indicating success or failure.
 */
export async function startGame( input: StartGameInput ): Promise<ErrorOnlyResponse> {
	const authInfo = requestInfo.ctx.authInfo!;
	try {
		await parseAsync( gameIdInput, input );
		const data = await getGameData( input.gameId );
		validateStartGame( data, authInfo.id );

		const workflow = await getWorkflow( input.gameId );
		await workflow.sendEvent( { type: "start-game", payload: input } );
		return { error: undefined };
	} catch ( err ) {
		logger.error( "Error starting game!", err );
		return { error: ( err as Error ).message };
	}
}

/**
 * Ask a card in a Fish game.
 * @param {AskEventInput} input - The input containing the game ID and card information.
 * @returns {Promise<ErrorOnlyResponse>} - An ErrorOnlyResponse indicating success or failure.
 */
export async function askCard( input: AskEventInput ): Promise<ErrorOnlyResponse> {
	const authInfo = requestInfo.ctx.authInfo!;
	try {
		await parseAsync( askCardInputSchema, input );
		const data = await getGameData( input.gameId );
		validateAskEvent( input, data, authInfo.id );

		const workflow = await getWorkflow( input.gameId );
		await workflow.sendEvent( { type: "ask-card", payload: input } );
		return { error: undefined };
	} catch ( err ) {
		logger.error( "Error asking card!", err );
		return { error: ( err as Error ).message };
	}
}

/**
 * Call a set in a Fish game.
 * @param {ClaimEventInput} input - The input containing the game ID and book information.
 * @returns {Promise<ErrorOnlyResponse>} - An ErrorOnlyResponse indicating success or failure.
 */
export async function claimBook( input: ClaimEventInput ): Promise<ErrorOnlyResponse> {
	const authInfo = requestInfo.ctx.authInfo!;
	logger.debug( input );
	try {
		await parseAsync( callSetInputSchema, input );
		const data = await getGameData( input.gameId );
		validateClaimEvent( input, data, authInfo.id );

		const workflow = await getWorkflow( input.gameId );
		await workflow.sendEvent( { type: "claim-book", payload: input } );
		return { error: undefined };
	} catch ( err ) {
		logger.error( "Error calling set!", err );
		return { error: ( err as Error ).message };
	}
}

/**
 * Transfer turn in a Fish game.
 * @param {TransferEventInput} input - The input containing the game ID and turn information.
 * @returns {Promise<ErrorOnlyResponse>} - An ErrorOnlyResponse indicating success or failure.
 */
export async function transferTurn( input: TransferEventInput ): Promise<ErrorOnlyResponse> {
	const authInfo = requestInfo.ctx.authInfo!;
	try {
		await parseAsync( transferTurnInputSchema, input );
		const data = await getGameData( input.gameId );
		validateTransferTurn( input, data, authInfo.id );

		const workflow = await getWorkflow( input.gameId );
		await workflow.sendEvent( { type: "transfer-turn", payload: input } );
		return { error: undefined };
	} catch ( err ) {
		logger.error( "Error transferring turn!", err );
		return { error: ( err as Error ).message };
	}
}
