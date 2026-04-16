import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import { createLogger } from "@/shared/utils/logger";
import { requireAuthInfo, requireGame } from "@/shared/utils/middlewares";
import { getWordleStub } from "@/shared/utils/stub";
import { WordleEngine } from "@/wordle/core/engine";
import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";

const logger = createLogger( "Wordle:Actions" );

export const getGame = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { gameId: v.string() } ) )
	.middleware( [ requireAuthInfo, requireGame( WordleEngine.NAME ) ] )
	.handler( async ( { context: { authInfo, game } } ) => {
		logger.debug( ">> getGame()" );

		const stub = getWordleStub( game.id );
		const { config, players, state, status, context } = await stub.getPlayerGameInfo( authInfo.id );

		logger.debug( "<< getGame()" );
		return { id: game.id, code: game.code, config, players, state, status, context };
	} );

export const createGame = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		wordCount: v.pipe( v.number(), v.integer(), v.minValue( 1 ) ),
		wordLength: v.picklist( [ 4, 5, 6 ] )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { wordCount, wordLength }, context: { authInfo } } ) => {
		logger.debug( ">> createGame()" );

		const [ game ] = await db.insert( games ).values( { game: WordleEngine.NAME } ).returning();

		const stub = getWordleStub( game.id );
		await stub.initialize( { playerCount: 1, wordCount, wordLength } );
		await stub.join( authInfo );

		logger.debug( "<< createGame()" );
		return game.id;
	} );

export const submitGuess = createServerFn( { method: "POST" } )
	.inputValidator( v.object( { gameId: v.string(), guess: v.string() } ) )
	.middleware( [ requireAuthInfo, requireGame( WordleEngine.NAME ) ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> submitGuess()" );

		const stub = getWordleStub( input.gameId );
		await stub.processMove( authInfo.id, "guess", input );

		logger.debug( "<< submitGuess()" );
	} );

export const getWords = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { gameId: v.string() } ) )
	.middleware( [ requireAuthInfo, requireGame( WordleEngine.NAME ) ] )
	.handler( async ( { data: { gameId } } ) => {
		logger.debug( ">> getWords()" );

		const stub = getWordleStub( gameId );
		const { state } = await stub.getGameData();

		logger.debug( "<< getWords()" );
		return state.words;
	} );
