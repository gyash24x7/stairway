import type { AuthInfo } from "@/auth/types";
import { createLogger } from "@/shared/utils/logger";
import type { CreateGameInput, GameData, GameIdInput, MakeGuessInput } from "@/wordle/types";
import { WordleEngine } from "@/wordle/worker/engine";
import { ORPCError } from "@orpc/server";
import { env } from "cloudflare:workers";

const logger = createLogger( "Wordle:Service" );

async function getGameData( input: GameIdInput, authInfo: AuthInfo ) {
	try {
		logger.debug( ">> getGameData()" );
		const engine = await initializeEngine( input.gameId, authInfo.id );
		return engine.getPlayerData();
	} catch ( error ) {
		logger.error( "Error initializing engine:", error );
		throw new ORPCError( "BAD_REQUEST", { message: ( error as Error ).message } );
	} finally {
		logger.debug( "<< getGameData()" );
	}
}

async function createGame( input: CreateGameInput, authInfo: AuthInfo ) {
	logger.debug( ">> createGame()" );
	const engine = WordleEngine.create( input, authInfo.id, saveGameData );
	await engine.saveGameData();
	logger.debug( "<< createGame()" );
	return { gameId: engine.id };
}

async function makeGuess( input: MakeGuessInput, authInfo: AuthInfo ) {
	try {
		logger.debug( ">> makeGuess()" );
		const engine = await initializeEngine( input.gameId, authInfo.id );
		engine.makeGuess( input.guess );
		await engine.saveGameData();
		return engine.getPlayerData();
	} catch ( error ) {
		logger.error( "Error making a guess:", error );
		throw new ORPCError( "BAD_REQUEST", { message: ( error as Error ).message } );
	} finally {
		logger.debug( "<< makeGuess()" );
	}
}

async function getWords( input: GameIdInput, authInfo: AuthInfo ) {
	try {
		logger.debug( ">> getWords()" );
		const engine = await initializeEngine( input.gameId, authInfo.id );
		return engine.getWords();
	} catch ( error ) {
		logger.error( "Error getting words:", error );
		throw new ORPCError( "BAD_REQUEST", { message: ( error as Error ).message } );
	} finally {
		logger.debug( "<< getWords()" );
	}
}

async function initializeEngine( gameId: string, playerId: string ) {
	const data = await loadGameData( gameId );
	if ( !data || data.playerId !== playerId ) {
		logger.error( "Game Not Found!" );
		throw "Game not found";
	}

	return new WordleEngine( data, saveGameData );
}

async function loadGameData( gameId: string ) {
	return env.WORDLE_KV.get( gameId ).then( d => !!d ? JSON.parse( d ) as GameData : undefined );
}

async function saveGameData( data: GameData ) {
	await env.WORDLE_KV.put( data.id, JSON.stringify( data ) );
}

export const service = { getGameData, createGame, makeGuess, getWords };