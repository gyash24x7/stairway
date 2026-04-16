import { KingdominoEngine } from "@/kingdomino/core/engine";
import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import { createLogger } from "@/shared/utils/logger";
import { requireAuthInfo, requireGame } from "@/shared/utils/middlewares";
import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";

const logger = createLogger( "Kingdomino:Actions" );

function getStub( gameId: string ) {
	return env.KINGDOMINO_ENGINE.get( env.KINGDOMINO_ENGINE.idFromName( gameId ) );
}

export const getGame = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { gameId: v.string() } ) )
	.middleware( [ requireAuthInfo, requireGame( KingdominoEngine.NAME ) ] )
	.handler( async ( { context: { authInfo, game } } ) => {
		logger.debug( ">> getGame()" );

		const stub = getStub( game.id );
		const { config, players, state, status } = await stub.getPlayerGameInfo( authInfo.id );

		logger.debug( "<< getGame()" );
		return { id: game.id, code: game.code, config, players, state, status };
	} );

export const createGame = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		playerCount: v.pipe( v.number(), v.integer(), v.minValue( 2 ), v.maxValue( 4 ) ),
		boardSize: v.picklist( [ 5, 7 ] )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { playerCount, boardSize }, context: { authInfo } } ) => {
		logger.debug( ">> createGame()" );

		const [ game ] = await db.insert( games ).values( { game: KingdominoEngine.NAME } ).returning();
		const effectiveBoardSize = playerCount <= 2 ? 7 : boardSize;
		const config = { playerCount, boardSize: effectiveBoardSize };

		const stub = getStub( game.id );
		await stub.initialize( { ...config, autoStart: true } );
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
			where: and( eq( games.code, code ), eq( games.game, KingdominoEngine.NAME ) )
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

export const selectDomino = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		gameId: v.string(),
		dominoId: v.number()
	} ) )
	.middleware( [ requireAuthInfo, requireGame( KingdominoEngine.NAME ) ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> selectDomino()" );

		const stub = getStub( input.gameId );
		await stub.processMove( authInfo.id, "selectDomino", input );

		logger.debug( "<< selectDomino()" );
	} );

export const placeDomino = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		gameId: v.string(),
		placement: v.object( {
			dominoId: v.number(),
			coord: v.object( { x: v.number(), y: v.number() } ),
			rotation: v.picklist( [ 0, 90, 180, 270 ] )
		} )
	} ) )
	.middleware( [ requireAuthInfo, requireGame( KingdominoEngine.NAME ) ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> placeDomino()" );

		const stub = getStub( input.gameId );
		await stub.processMove( authInfo.id, "placeDomino", input );

		logger.debug( "<< placeDomino()" );
	} );

export const discardDomino = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		gameId: v.string(),
		dominoId: v.number()
	} ) )
	.middleware( [ requireAuthInfo, requireGame( KingdominoEngine.NAME ) ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> discardDomino()" );

		const stub = getStub( input.gameId );
		await stub.processMove( authInfo.id, "discardDomino", input );

		logger.debug( "<< discardDomino()" );
	} );
