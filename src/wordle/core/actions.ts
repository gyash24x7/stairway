"use server";

import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import type { GameId, GameIdInput } from "@/shared/engine/types";
import { createLogger } from "@/shared/utils/logger";
import { getAuthInfo, requireGame, validate } from "@/shared/utils/middlewares";
import { WordleEngine } from "@/wordle/core/engine";
import type { CreateGameInput, GuessInput } from "@/wordle/core/types";
import { env } from "cloudflare:workers";
import { serverAction, serverQuery } from "rwsdk/worker";
import * as v from "valibot";

const logger = createLogger( "Wordle:Actions" );

function getStub( gameId: GameId ) {
	const durableObjectId = env.WORDLE_ENGINE.idFromName( `${ WordleEngine.NAME }:${ gameId }` );
	return env.WORDLE_ENGINE.get( durableObjectId );
}

export const getGame = serverQuery( [
	validate( v.object( { gameId: v.string() } ) ),
	async ( input: GameIdInput ) => {
		logger.debug( ">> getGame()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( WordleEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		const { config, players, state, status, context } = await stub.getPlayerGameInfo( authInfo.id );

		logger.debug( "<< getGame()" );
		return { id: game.id, code: game.code, config, players, state, status, context };
	}
] );

export const createGame = serverAction( [
	validate( v.object( {
		wordCount: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 16 ) ),
		wordLength: v.picklist( [ 4, 5, 6 ] )
	} ) ),
	async ( input: CreateGameInput ) => {
		logger.debug( ">> createGame()" );

		const authInfo = getAuthInfo();
		const [ game ] = await db.insert( games ).values( { game: WordleEngine.NAME } ).returning();

		const stub = getStub( game.id );
		await stub.initialize( game.id, game.code, { playerCount: 1, ...input } );
		await stub.join( authInfo );

		logger.debug( "<< createGame()" );
		return game.id;
	}
] );

export const submitGuess = serverAction( [
	validate( v.object( { gameId: v.string(), guess: v.string() } ) ),
	async ( input: GuessInput ) => {
		logger.debug( ">> submitGuess()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( WordleEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.processMove( authInfo.id, "guess", input );

		logger.debug( "<< submitGuess()" );
	}
] );

export const getWords = serverQuery( [
	validate( v.object( { gameId: v.string() } ) ),
	async ( input: GameIdInput ) => {
		logger.debug( ">> getWords()" );

		getAuthInfo();
		const game = await requireGame( WordleEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		const { state, status } = await stub.getGameData();

		if ( status !== "COMPLETED" ) {
			throw new Response( null, { status: 403 } );
		}

		logger.debug( "<< getWords()" );
		return state.words;
	}
] );
