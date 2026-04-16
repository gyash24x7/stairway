import { requireAuthInfo } from "@/auth/core/utils";
import { generateGameCode, generateId } from "@/shared/utils/generator";
import { createLogger } from "@/shared/utils/logger";
import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import * as v from "valibot";

const logger = createLogger( "Wordle:Actions" );

function getStub( gameId: string ) {
	return env.WORDLE_ENGINE.get( env.WORDLE_ENGINE.idFromName( gameId ) );
}

export const getGame = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { gameId: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { gameId }, context: { authInfo } } ) => {
		logger.debug( ">> getGame()" );

		const code = env.KV.get( gameId );
		if ( !code ) {
			logger.error( "Game not found!" );
			throw new Response( null, { status: 404 } );
		}

		const stub = getStub( gameId );
		const { config, players, state, status } = await stub.getPlayerGameInfo( authInfo.id );

		logger.debug( "<< getGame()" );
		return { id: gameId, code, config, players, state, status };
	} );

export const createGame = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		wordCount: v.pipe( v.number(), v.integer(), v.minValue( 1 ) ),
		wordLength: v.picklist( [ 4, 5, 6 ] )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { wordCount, wordLength }, context: { authInfo } } ) => {
		logger.debug( ">> createGame()" );

		const gameId = generateId();
		const code = generateGameCode();
		await env.KV.put( gameId, code );

		const stub = getStub( gameId );
		await stub.initialize( { playerCount: 1, wordCount, wordLength } );
		await stub.join( authInfo );

		logger.debug( "<< createGame()" );
		return gameId;
	} );

export const submitGuess = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		gameId: v.string(),
		guess: v.string()
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> submitGuess()" );

		const stub = getStub( input.gameId );
		await stub.processMove( authInfo.id, "guess", input );

		logger.debug( "<< submitGuess()" );
	} );

export const getWords = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { gameId: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { gameId } } ) => {
		logger.debug( ">> getWords()" );

		const stub = getStub( gameId );
		const { state } = await stub.getGameData();

		logger.debug( "<< getWords()" );
		return state.words;
	} );
