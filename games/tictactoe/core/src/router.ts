import { getCompletedGame, requireGame, requireGameByCode } from "@s2h/api/helpers";
import { authed } from "@s2h/api/middleware";
import { db } from "@s2h/db";
import { games } from "@s2h/db/schema";
import type { BaseGameConfig } from "@s2h/engine/types";
import { createLogger } from "@s2h/shared/utils/logger";
import { GAME_NAME } from "./utils";
import type { TicTacToePlayerView, TicTacToeSharedView } from "./types";
import * as v from "valibot";

const logger = createLogger( "TicTacToe:Router" );

/** Resolves the Tic-Tac-Toe engine Durable Object stub for a game id. */
function getStub( env: Env, gameId: string ) {
	const name = `${ GAME_NAME }:${ gameId }`;
	return env.TIC_TAC_TOE_ENGINE.get( env.TIC_TAC_TOE_ENGINE.idFromName( name ) );
}

/** Fetches the current Tic-Tac-Toe game state for the authenticated player. */
export const getGame = authed
	.input( v.object( { gameId: v.string() } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> getGame()" );

		const game = await requireGame( GAME_NAME, input.gameId );

		if ( game.completed ) {
			const { shared, playerViews } = await getCompletedGame<
				TicTacToeSharedView, BaseGameConfig, TicTacToePlayerView
			>( context.env, GAME_NAME, game.id );
			logger.debug( "<< getGame() [completed]" );
			return { shared, player: playerViews[ context.user.id ] };
		}

		const stub = getStub( context.env, game.id );
		const { shared, player } = await stub.getPlayerGameInfo( context.user.id );

		logger.debug( "<< getGame()" );
		return { shared, player };
	} );

/** Creates a new Tic-Tac-Toe game and returns its id. */
export const createGame = authed
	.handler( async ( { context } ) => {
		logger.debug( ">> createGame()" );

		const [ game ] = await db.insert( games )
			.values( { game: GAME_NAME } )
			.returning();

		logger.debug( "Game Created! %s:%s", GAME_NAME, game.id );

		const stub = getStub( context.env, game.id );
		await stub.initialize( game.id, game.code, { playerCount: 2, autoStart: true } );
		await stub.join( context.user );

		logger.debug( "<< createGame()" );
		return game.id;
	} );

/** Joins an existing Tic-Tac-Toe game by its join code and returns its id. */
export const joinGame = authed
	.input( v.object( { code: v.string() } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> joinGame()" );

		const game = await requireGameByCode( GAME_NAME, input.code );
		const stub = getStub( context.env, game.id );
		await stub.join( context.user );

		logger.debug( "<< joinGame()" );
		return game.id;
	} );

/** Places a symbol on the board at a specified position. */
export const placeMove = authed
	.input( v.object( {
		gameId: v.string(),
		position: v.pipe( v.number(), v.integer(), v.minValue( 0 ), v.maxValue( 8 ) )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> placeMove()" );

		const game = await requireGame( GAME_NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.processMove( context.user.id, "place", input );

		logger.debug( "<< placeMove()" );
	} );

/** Adds a bot opponent to the game. */
export const addBots = authed
	.input( v.object( { gameId: v.string() } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> addBots()" );

		const game = await requireGame( GAME_NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.addBots();

		logger.debug( "<< addBots()" );
	} );
