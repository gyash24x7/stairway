"use server";

import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import type { GameId, GameIdInput } from "@/shared/engine/types";
import { createLogger } from "@/shared/utils/logger";
import { getAuthInfo, getCompletedGame, requireGame, validate } from "@/shared/utils/middlewares";
import { WordleEngine } from "@/wordle/core/engine";
import type { CreateGameInput, GuessInput } from "@/wordle/core/types";
import { env } from "cloudflare:workers";
import { serverAction, serverQuery } from "rwsdk/worker";
import * as v from "valibot";

const logger = createLogger( "Wordle:Actions" );

/**
 * Get a Durable Object stub for a Wordle game engine instance.
 *
 * @param gameId - The game ID to look up.
 * @returns The Durable Object stub for the game engine.
 */
function getStub( gameId: GameId ) {
	const name = `${ WordleEngine.NAME }:${ gameId }`;
	const durableObjectId = env.WORDLE_ENGINE.idFromName( name );
	return env.WORDLE_ENGINE.get( durableObjectId );
}

/** Server query to fetch the current Wordle game state for the authenticated player. */
export const getGame = serverQuery( [
	validate( v.object( { gameId: v.string() } ) ),
	async ( input: GameIdInput ) => {
		logger.debug( ">> getGame()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( WordleEngine.NAME, input.gameId );

		if ( game.completed ) {
			const { shared, playerViews } = await getCompletedGame( WordleEngine.NAME, game.id );
			logger.debug( "<< getGame() [completed]" );
			return { shared, player: playerViews[ authInfo.id ] };
		}

		const stub = getStub( game.id );
		const { shared, player } = await stub.getPlayerGameInfo( authInfo.id );

		logger.debug( "<< getGame()" );
		return { shared, player };
	}
] );

/** Server action to create a new Wordle game with the specified word count and length. */
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
		await stub.initialize( game.id, game.code, { playerCount: 1, autoStart: true, ...input } );
		await stub.join( authInfo );

		logger.debug( "<< createGame()" );
		return game.id;
	}
] );

/** Server action to submit a guess word for the current Wordle game. */
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

/** Server query to retrieve the target words after game completion. */
export const getWords = serverQuery( [
	validate( v.object( { gameId: v.string() } ) ),
	async ( input: GameIdInput ) => {
		logger.debug( ">> getWords()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( WordleEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		const {} = await stub.getPlayerGameInfo( authInfo.id );

		logger.debug( "<< getWords()" );
		return [];
	}
] );
