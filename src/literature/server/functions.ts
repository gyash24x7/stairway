"use server";

import {
	type AskCardInput,
	askCardInputSchema,
	type CallSetInput,
	callSetInputSchema,
	type CreateGameInput,
	createGameInputSchema,
	type CreateTeamsInput,
	createTeamsInputSchema,
	type GameIdInput,
	gameIdInputSchema,
	type JoinGameInput,
	joinGameInputSchema,
	type TransferTurnInput,
	transferTurnInputSchema
} from "@/literature/server/inputs";
import { createLogger } from "@/shared/utils/logger";
import { env } from "cloudflare:workers";
import { requestInfo } from "rwsdk/worker";

const logger = createLogger( "Literature:Functions" );

function getStub() {
	const durableObjectId = env.LITERATURE_DURABLE_OBJECT.idFromName( "stairway" );
	return env.LITERATURE_DURABLE_OBJECT.get( durableObjectId );
}

export async function createGame( input: CreateGameInput ) {
	const { error, success } = await createGameInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for createGame", { error, input } );
		return { error: error.message, success: false as const };
	}

	try {
		const stub = getStub();
		const data = await stub.createGame( input, requestInfo.ctx.authInfo! );
		return { data, success: true as const };
	} catch ( err ) {
		logger.error( "Error creating game", { error: err, input } );
		return { error: "Failed to create game. Please try again later.", success: false as const };
	}
}

export async function joinGame( input: JoinGameInput ) {
	const { error, success } = await joinGameInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for join game", { error, input } );
		return { error: error.message, success: false as const };
	}

	try {
		const stub = getStub();
		const data = await stub.joinGame( input, requestInfo.ctx.authInfo! );
		return { data, success: true as const };
	} catch ( err ) {
		logger.error( "Error joining game", { error: err, input } );
		return { error: "Failed to join game. Please try again later.", success: false as const };
	}
}

export async function getGameData( input: GameIdInput ) {
	const { error, success } = await gameIdInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for getGameData", { error, input } );
		return { error: error.message, success: false as const };
	}

	try {
		const stub = getStub();
		const data = await stub.getGameStore( input.gameId, requestInfo.ctx.authInfo! );
		return { data, success: true as const };
	} catch ( err ) {
		logger.error( "Error getting game", { error: err, input } );
		return { error: "Failed to get game. Please try again later.", success: false as const };
	}
}

export async function addBots( input: GameIdInput ) {
	const { error, success } = await gameIdInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for addBots", { error, input } );
		return { error: error.message, success: false as const };
	}

	try {
		const stub = getStub();
		await stub.addBots( input, requestInfo.ctx.authInfo! );
		return { success: true as const };
	} catch ( err ) {
		logger.error( "Error creating game", { error: err, input } );
		return { error: "Failed to create game. Please try again later.", success: false as const };
	}
}

export async function createTeams( input: CreateTeamsInput ) {
	const { error, success } = await createTeamsInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for create teams", { error, input } );
		return { error: error.message, success: false as const };
	}

	try {
		const stub = getStub();
		await stub.createTeams( input, requestInfo.ctx.authInfo! );
		return { success: true as const };
	} catch ( err ) {
		logger.error( "Error creating teams", { error: err, input } );
		return { error: "Failed to create teams. Please try again later.", success: false as const };
	}
}

export async function startGame( input: GameIdInput ) {
	const { error, success } = await gameIdInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for start game", { error, input } );
		return { error: error.message, success: false as const };
	}

	try {
		const stub = getStub();
		await stub.startGame( input, requestInfo.ctx.authInfo! );
		return { success: true as const };
	} catch ( err ) {
		logger.error( "Error starting game", { error: err, input } );
		return { error: "Failed to start game. Please try again later.", success: false as const };
	}
}

export async function askCard( input: AskCardInput ) {
	const { error, success } = await askCardInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for ask card", { error, input } );
		return { error: error.message, success: false as const };
	}

	try {
		const stub = getStub();
		await stub.askCard( input, requestInfo.ctx.authInfo! );
		return { success: true as const };
	} catch ( err ) {
		logger.error( "Error asking card", { error: err, input } );
		return { error: "Failed to ask card. Please try again later.", success: false as const };
	}
}

export async function callSet( input: CallSetInput ) {
	const { error, success } = await callSetInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for call set", { error, input } );
		return { error: error.message, success: false as const };
	}

	try {
		const stub = getStub();
		await stub.callSet( input, requestInfo.ctx.authInfo! );
		return { success: true as const };
	} catch ( err ) {
		logger.error( "Error calling set", { error: err, input } );
		return { error: "Failed to call set. Please try again later.", success: false as const };
	}
}

export async function transferTurn( input: TransferTurnInput ) {
	const { error, success } = await transferTurnInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for transfer turn", { error, input } );
		return { error: error.message, success: false as const };
	}

	try {
		const stub = getStub();
		await stub.transferTurn( input, requestInfo.ctx.authInfo! );
		return { success: true as const };
	} catch ( err ) {
		logger.error( "Error transferring turn", { error: err, input } );
		return { error: "Failed to transfer turn. Please try again later.", success: false as const };
	}
}

export async function executeBotMove( input: GameIdInput ) {
	const { error, success } = await gameIdInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid input for execute bot move", { error, input } );
		return { error: error.message, success: false as const };
	}

	try {
		const stub = getStub();
		await stub.executeBotMove( input, requestInfo.ctx.authInfo! );
		return { success: true as const };
	} catch ( err ) {
		logger.error( "Error executing bot move", { error: err, input } );
		return { error: "Failed to execute bot move. Please try again later.", success: false as const };
	}
}