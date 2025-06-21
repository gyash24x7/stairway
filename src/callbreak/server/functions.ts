"use server";

import type { CreateGameInput, DeclareDealWinsInput, JoinGameInput, PlayCardInput } from "@/callbreak/server/inputs";
import {
	createGameInputSchema,
	declareDealWinsInputSchema,
	gameIdInputSchema,
	joinGameInputSchema,
	playCardInputSchema
} from "@/callbreak/server/inputs";
import * as service from "@/callbreak/server/service";
import { createLogger } from "@/shared/utils/logger";
import { requestInfo } from "rwsdk/worker";

const logger = createLogger( "Callbreak:Functions" );

export async function createGame( input: CreateGameInput ) {
	const { error, success } = await createGameInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid Input!" );
		return { error: error?.message };
	}

	try {
		const data = await service.createGame( input, requestInfo.ctx.authInfo! );
		return { data };
	} catch ( err ) {
		logger.error( "Error creating game!" );
		return { error: ( err as Error ).message };
	}
}

export async function joinGame( input: JoinGameInput ) {
	const { success, error } = await joinGameInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid Input!" );
		return { error: error?.message };
	}

	try {
		const data = await service.joinGame( input, requestInfo.ctx.authInfo! );
		return { data };
	} catch ( err ) {
		logger.error( "Unable to join the game!" );
		return { error: ( err as Error ).message };
	}
}

export async function getGameData( gameId: string ) {
	const { success, error } = await gameIdInputSchema.safeParseAsync( { gameId } );
	if ( !success || !!error ) {
		logger.error( "Invalid Game Id!" );
		return { error: error?.message };
	}

	try {
		const { game, players } = await service.getBaseGameData( gameId );
		if ( !players[ requestInfo.ctx.authInfo!.id ] ) {
			logger.error( "Logged In User not part of this game! UserId: %s", requestInfo.ctx.authInfo!.id );
			return { error: "User not part of this game!" };
		}

		const data = await service.getGameData( { game, players, authInfo: requestInfo.ctx.authInfo! } );
		return { data };
	} catch ( err ) {
		logger.error( "Unable to get game data!", err );
		return { error: ( err as Error ).message };
	}
}

export async function addBots( gameId: string ) {
	const { success, error } = await gameIdInputSchema.safeParseAsync( { gameId } );
	if ( !success || !!error ) {
		logger.error( "Invalid Game Id!" );
		return { error: error?.message };
	}

	try {
		const { game, players } = await service.getBaseGameData( gameId );
		if ( !players[ requestInfo.ctx.authInfo!.id ] ) {
			logger.error( "Logged In User not part of this game! UserId: %s", requestInfo.ctx.authInfo!.id );
			return { error: "User not part of this game!" };
		}

		const data = await service.addBots( { game, players } );
		return { data };
	} catch ( err ) {
		logger.error( "Unable to add bots!" );
		return { error: ( err as Error ).message };
	}
}

export async function declareDealWins( input: DeclareDealWinsInput ) {
	const { success, error } = await declareDealWinsInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid Input!" );
		return { error: error?.message };
	}

	try {
		const { game, players } = await service.getBaseGameData( input.gameId );
		if ( !players[ requestInfo.ctx.authInfo!.id ] ) {
			logger.error( "Logged In User not part of this game! UserId: %s", requestInfo.ctx.authInfo!.id );
			return { error: "User not part of this game!" };
		}

		const data = await service.declareDealWins( input, { game, players } );
		return { data };
	} catch ( err ) {
		logger.error( "Unable to declare deal wins!" );
		return { error: ( err as Error ).message };
	}
}

export async function playCard( input: PlayCardInput ) {
	const { success, error } = await playCardInputSchema.safeParseAsync( input );
	if ( !success || !!error ) {
		logger.error( "Invalid Input!" );
		return { error: error?.message };
	}

	try {
		const { game, players } = await service.getBaseGameData( input.gameId );
		if ( !players[ requestInfo.ctx.authInfo!.id ] ) {
			logger.error( "Logged In User not part of this game! UserId: %s", requestInfo.ctx.authInfo!.id );
			return { error: "User not part of this game!" };
		}

		const data = await service.playCard( input, { game, players } );
		return { data };
	} catch ( err ) {
		logger.error( "Unable to play card!" );
		return { error: ( err as Error ).message };
	}
}
