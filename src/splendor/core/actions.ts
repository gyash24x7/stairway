import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import { createLogger } from "@/shared/utils/logger";
import { requireAuthInfo, requireGame } from "@/shared/utils/middlewares";
import { SplendorEngine } from "@/splendor/core/engine";
import { GEMS } from "@/splendor/core/utils";
import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";

const logger = createLogger( "Splendor:Actions" );

function getStub( gameId: string ) {
	return env.SPLENDOR_ENGINE.get( env.SPLENDOR_ENGINE.idFromName( gameId ) );
}

export const getGame = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { gameId: v.string() } ) )
	.middleware( [ requireAuthInfo, requireGame( SplendorEngine.NAME ) ] )
	.handler( async ( { context: { authInfo, game } } ) => {
		logger.debug( ">> getGame()" );

		const stub = getStub( game.id );
		const { config, players, state, status } = await stub.getPlayerGameInfo( authInfo.id );

		logger.debug( "<< getGame()" );
		return { id: game.id, code: game.code, config, players, state, status };
	} );

export const createGame = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		playerCount: v.pipe( v.number(), v.integer(), v.picklist( [ 2, 3, 4 ] ) ),
		winningPoints: v.pipe( v.number(), v.integer(), v.minValue( 1 ) )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: config, context: { authInfo } } ) => {
		logger.debug( ">> createGame()" );

		const [ game ] = await db.insert( games ).values( { game: SplendorEngine.NAME } ).returning();

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
			where: and( eq( games.code, code ), eq( games.game, SplendorEngine.NAME ) )
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

export const pickTokens = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		gameId: v.string(),
		tokens: v.record( v.picklist( GEMS ), v.number() ),
		returned: v.optional( v.record( v.picklist( GEMS ), v.number() ) )
	} ) )
	.middleware( [ requireAuthInfo, requireGame( SplendorEngine.NAME ) ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> pickTokens()" );

		const stub = getStub( input.gameId );
		await stub.processMove( authInfo.id, "pickTokens", input );

		logger.debug( "<< pickTokens()" );
	} );

export const reserveCard = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		gameId: v.string(),
		cardId: v.string(),
		withGold: v.boolean(),
		returnedToken: v.optional( v.picklist( GEMS ) )
	} ) )
	.middleware( [ requireAuthInfo, requireGame( SplendorEngine.NAME ) ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> reserveCard()" );

		const stub = getStub( input.gameId );
		await stub.processMove( authInfo.id, "reserveCard", input );

		logger.debug( "<< reserveCard()" );
	} );

export const purchaseCard = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		gameId: v.string(),
		cardId: v.string(),
		payment: v.record( v.string(), v.number() )
	} ) )
	.middleware( [ requireAuthInfo, requireGame( SplendorEngine.NAME ) ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> purchaseCard()" );

		const stub = getStub( input.gameId );
		await stub.processMove( authInfo.id, "purchaseCard", input );

		logger.debug( "<< purchaseCard()" );
	} );
