import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import { createLogger } from "@/shared/utils/logger";
import { requireAuthInfo, requireGame } from "@/shared/utils/middlewares";
import { TicTacToeEngine } from "@/tictactoe/core/engine";
import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";

const logger = createLogger( "TicTacToe:Actions" );

function getStub( gameId: string ) {
	return env.TICTACTOE_ENGINE.get( env.TICTACTOE_ENGINE.idFromName( gameId ) );
}

export const getGame = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { gameId: v.string() } ) )
	.middleware( [ requireAuthInfo, requireGame( TicTacToeEngine.NAME ) ] )
	.handler( async ( { context: { authInfo, game } } ) => {
		logger.debug( ">> getGame()" );

		const stub = getStub( game.id );
		const { config, players, state, status } = await stub.getPlayerGameInfo( authInfo.id );

		logger.debug( "<< getGame()" );
		return { id: game.id, code: game.code, config, players, state, status };
	} );

export const createGame = createServerFn( { method: "POST" } )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { context: { authInfo } } ) => {
		logger.debug( ">> createGame()" );

		const [ game ] = await db.insert( games ).values( { game: TicTacToeEngine.NAME } ).returning();

		const stub = getStub( game.id );
		await stub.initialize( { playerCount: 2 } );
		await stub.join( authInfo );

		logger.debug( "<< createGame()" );
		return game.id;
	} );

export const joinGame = createServerFn( { method: "POST" } )
	.inputValidator( v.object( { code: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { code }, context: { authInfo } } ) => {
		logger.debug( ">> joinGame()" );

		const game = await db.query.games.findFirst( {
			where: and( eq( games.code, code ), eq( games.game, TicTacToeEngine.NAME ) )
		} );

		if ( !game ) {
			logger.error( "Game not found!" );
			throw new Response( null, { status: 404 } );
		}

		const stub = getStub( game.id );
		await stub.join( authInfo );

		logger.debug( "<< joinGame()" );
		return game.id;
	} );

export const placeMove = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		gameId: v.string(),
		position: v.pipe( v.number(), v.integer(), v.minValue( 0 ), v.maxValue( 8 ) )
	} ) )
	.middleware( [ requireAuthInfo, requireGame( TicTacToeEngine.NAME ) ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> placeMove()" );

		const stub = getStub( input.gameId );
		await stub.processMove( authInfo.id, "place", input );

		logger.debug( "<< placeMove()" );
	} );
