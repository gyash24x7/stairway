import { getCompletedGame, requireGame } from "@/api/helpers";
import { authed } from "@/api/middleware";
import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import { createLogger } from "@/shared/utils/logger";
import { WordleEngine } from "@/wordle/core/engine";
import type { WordleConfig, WordlePlayerView, WordleSharedView } from "@/wordle/core/types";
import * as v from "valibot";

const logger = createLogger( "Wordle:Router" );

/** Resolves the Wordle engine Durable Object stub for a game id. */
function getStub( env: Env, gameId: string ) {
	const name = `${ WordleEngine.NAME }:${ gameId }`;
	return env.WORDLE_ENGINE.get( env.WORDLE_ENGINE.idFromName( name ) );
}

/** Fetches the current Wordle game state for the authenticated player. */
export const getGame = authed
	.input( v.object( { gameId: v.string() } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> getGame()" );

		const game = await requireGame( WordleEngine.NAME, input.gameId );

		if ( game.completed ) {
			const { shared, playerViews } = await getCompletedGame<
				WordleSharedView, WordleConfig, WordlePlayerView
			>( context.env, WordleEngine.NAME, game.id );
			logger.debug( "<< getGame() [completed]" );
			return { shared, player: playerViews[ context.user.id ] };
		}

		const stub = getStub( context.env, game.id );
		const result = await stub.getPlayerGameInfo( context.user.id );

		logger.debug( "<< getGame()" );
		return result;
	} );

/** Creates a new single-player Wordle game and returns its id. */
export const createGame = authed
	.input( v.object( {
		wordCount: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 16 ) ),
		wordLength: v.picklist( [ 4, 5, 6 ] )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> createGame()" );

		const [ game ] = await db.insert( games ).values( { game: WordleEngine.NAME } ).returning();

		const stub = getStub( context.env, game.id );
		await stub.initialize( game.id, game.code, { playerCount: 1, autoStart: true, ...input } );
		await stub.join( context.user );

		logger.debug( "<< createGame()" );
		return game.id;
	} );

/** Submits a guess for the current Wordle game. */
export const submitGuess = authed
	.input( v.object( { gameId: v.string(), guess: v.string() } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> submitGuess()" );

		const game = await requireGame( WordleEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.processMove( context.user.id, "guess", input );

		logger.debug( "<< submitGuess()" );
	} );

/** Reveals the target words after the game has completed. */
export const getWords = authed
	.input( v.object( { gameId: v.string() } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> getWords()" );

		const game = await requireGame( WordleEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		const { words } = await stub.getWords( context.user.id );

		logger.debug( "<< getWords()" );
		return words;
	} );
