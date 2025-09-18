import type { AuthInfo } from "@/auth/types";
import type {
	CreateGameInput,
	DeclareDealWinsInput,
	GameData,
	GameIdInput,
	JoinGameInput,
	PlayCardInput
} from "@/callbreak/types";
import { CallbreakEngine } from "@/callbreak/worker/engine";
import { createLogger } from "@/shared/utils/logger";
import { ORPCError } from "@orpc/server";
import { env } from "cloudflare:workers";

const logger = createLogger( "Callbreak:Service" );

async function getGameData( input: GameIdInput, authInfo: AuthInfo ) {
	try {
		logger.debug( ">> getGameData()" );
		const engine = await initializeEngine( input.gameId, authInfo.id );
		return engine.getPlayerData( authInfo.id );
	} catch ( error ) {
		logger.error( "Error initializing engine:", error );
		throw new ORPCError( "BAD_REQUEST", { message: ( error as Error ).message } );
	} finally {
		logger.debug( "<< getGameData()" );
	}
}

async function createGame( input: CreateGameInput, authInfo: AuthInfo ) {
	logger.debug( ">> createGame()" );
	const engine = CallbreakEngine.create( input, authInfo.id, saveGameData );
	engine.addPlayer( authInfo );
	await engine.saveGameData();
	logger.debug( "<< createGame()" );
	return { gameId: engine.id };
}

async function joinGame( input: JoinGameInput, authInfo: AuthInfo ) {
	logger.debug( ">> joinGame()" );

	const gameId = await env.CALLBREAK_KV.get( `code:${ input.code }` );
	if ( !gameId ) {
		logger.debug( "Game not found for code %s!", input.code );
		throw new ORPCError( "BAD_REQUEST", { message: "Game not found!" } );
	}

	try {
		const engine = await initializeEngine( gameId, authInfo.id );
		engine.addPlayer( authInfo );
		await engine.saveGameData();
		return { gameId: engine.id };
	} catch ( error ) {
		logger.error( "Error initializing engine:", error );
		throw new ORPCError( "BAD_REQUEST", { message: ( error as Error ).message } );
	} finally {
		logger.debug( "<< joinGame()" );
	}
}

async function declareDealWins( input: DeclareDealWinsInput, authInfo: AuthInfo ) {
	try {
		logger.debug( ">> declareDealWins()" );
		const engine = await initializeEngine( input.gameId, authInfo.id );
		engine.declareDealWins( input, authInfo );
		await engine.saveGameData();
	} catch ( error ) {
		logger.error( "Error declaring wins", error );
		throw new ORPCError( "BAD_REQUEST", { message: ( error as Error ).message } );
	} finally {
		logger.debug( "<< declareDealWins()" );
	}
}

async function playCard( input: PlayCardInput, authInfo: AuthInfo ) {
	try {
		logger.debug( ">> playCard()" );
		const engine = await initializeEngine( input.gameId, authInfo.id );
		engine.playCard( input, authInfo );
		await engine.saveGameData();
	} catch ( error ) {
		logger.error( "Error playing card", error );
		throw new ORPCError( "BAD_REQUEST", { message: ( error as Error ).message } );
	} finally {
		logger.debug( "<< playCard()" );
	}
}

async function initializeEngine( gameId: string, playerId: string ) {
	const data = await loadGameData( gameId );
	if ( !data || !data.players[ playerId ] ) {
		logger.error( "Game Not Found!" );
		throw "Game not found";
	}

	return new CallbreakEngine( data, saveGameData );
}

async function loadGameData( gameId: string ) {
	return env.CALLBREAK_KV.get( gameId )
		.then( d => !!d ? JSON.parse( d ) as GameData : undefined );
}

async function saveGameData( data: GameData ) {
	await env.CALLBREAK_KV.put( data.id, JSON.stringify( data ) );
}


export const service = {
	getGameData,
	createGame,
	joinGame,
	declareDealWins,
	playCard
};