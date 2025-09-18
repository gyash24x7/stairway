import type { AuthInfo } from "@/auth/types";
import type {
	AskEventInput,
	ClaimEventInput,
	CreateGameInput,
	CreateTeamsInput,
	GameData,
	GameIdInput,
	JoinGameInput,
	StartGameInput,
	TransferEventInput
} from "@/fish/types";
import { FishEngine } from "@/fish/worker/engine";
import { createLogger } from "@/shared/utils/logger";
import { ORPCError } from "@orpc/server";
import { env } from "cloudflare:workers";

const logger = createLogger( "Fish:Service" );

async function getGameData( input: GameIdInput, authInfo: AuthInfo ) {
	try {
		logger.debug( ">> getGameData()" );
		const engine = await initializeEngine( input.gameId, authInfo.id );
		return engine.getPlayerGameInfo( authInfo.id );
	} catch ( error ) {
		logger.error( "Error initializing engine:", error );
		throw new ORPCError( "BAD_REQUEST", { message: ( error as Error ).message } );
	} finally {
		logger.debug( "<< getGameData()" );
	}
}

async function createGame( input: CreateGameInput, authInfo: AuthInfo ) {
	logger.debug( ">> createGame()" );
	const engine = FishEngine.create( input, authInfo, saveGameData );
	engine.addPlayer( authInfo );
	await engine.saveGameData();
	logger.debug( "<< createGame()" );
	return { gameId: engine.id };
}

async function joinGame( input: JoinGameInput, authInfo: AuthInfo ) {
	logger.debug( ">> joinGame()" );

	const gameId = await env.FISH_KV.get( `code:${ input.code }` );
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

async function createTeams( input: CreateTeamsInput, authInfo: AuthInfo ) {
	try {
		logger.debug( ">> createTeams()" );
		const engine = await initializeEngine( input.gameId, authInfo.id );
		engine.createTeams( input, authInfo );
		await engine.saveGameData();
	} catch ( error ) {
		logger.error( "Error creating teams", error );
		throw new ORPCError( "BAD_REQUEST", { message: ( error as Error ).message } );
	} finally {
		logger.debug( "<< createTeams()" );
	}
}

async function startGame( input: StartGameInput, authInfo: AuthInfo ) {
	try {
		logger.debug( ">> startGame()" );
		const engine = await initializeEngine( input.gameId, authInfo.id );
		engine.startGame( input, authInfo );
		await engine.saveGameData();
	} catch ( error ) {
		logger.error( "Error starting game", error );
		throw new ORPCError( "BAD_REQUEST", { message: ( error as Error ).message } );
	} finally {
		logger.debug( "<< startGame()" );
	}
}

async function askCard( input: AskEventInput, authInfo: AuthInfo ) {
	try {
		logger.debug( ">> askCard()" );
		const engine = await initializeEngine( input.gameId, authInfo.id );
		engine.handleAskEvent( input, authInfo );
		await engine.saveGameData();
	} catch ( error ) {
		logger.error( "Error asking card", error );
		throw new ORPCError( "BAD_REQUEST", { message: ( error as Error ).message } );
	} finally {
		logger.debug( "<< askCard()" );
	}
}

async function claimBook( input: ClaimEventInput, authInfo: AuthInfo ) {
	try {
		logger.debug( ">> claimBook()" );
		const engine = await initializeEngine( input.gameId, authInfo.id );
		engine.handleClaimEvent( input, authInfo );
		await engine.saveGameData();
	} catch ( error ) {
		logger.error( "Error claiming book", error );
		throw new ORPCError( "BAD_REQUEST", { message: ( error as Error ).message } );
	} finally {
		logger.debug( "<< claimBook()" );
	}
}

async function transferTurn( input: TransferEventInput, authInfo: AuthInfo ) {
	try {
		logger.debug( ">> transferTurn()" );
		const engine = await initializeEngine( input.gameId, authInfo.id );
		engine.handleTransferEvent( input, authInfo );
		await engine.saveGameData();
	} catch ( error ) {
		logger.error( "Error transferring turn", error );
		throw new ORPCError( "BAD_REQUEST", { message: ( error as Error ).message } );
	} finally {
		logger.debug( "<< transferTurn()" );
	}
}


async function initializeEngine( gameId: string, playerId: string ) {
	const data = await loadGameData( gameId );
	if ( !data || !data.players[ playerId ] ) {
		logger.error( "Game Not Found!" );
		throw "Game not found";
	}

	return new FishEngine( data, saveGameData );
}

async function loadGameData( gameId: string ) {
	return env.FISH_KV.get( gameId )
		.then( d => !!d ? JSON.parse( d ) as GameData : undefined );
}

async function saveGameData( data: GameData ) {
	await env.FISH_KV.put( data.id, JSON.stringify( data ) );
}

export const service = {
	getGameData,
	createGame,
	joinGame,
	createTeams,
	startGame,
	askCard,
	claimBook,
	transferTurn
};