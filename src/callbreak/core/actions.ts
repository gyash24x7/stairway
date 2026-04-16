import { CallbreakEngine } from "@/callbreak/core/engine";
import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import { CARD_SUITS, SORTED_DECK } from "@/shared/utils/cards";
import { createLogger } from "@/shared/utils/logger";
import { requireAuthInfo, requireGame } from "@/shared/utils/middlewares";
import { getCallbreakStub } from "@/shared/utils/stub";
import { SplendorEngine } from "@/splendor/core/engine";
import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";

const logger = createLogger( "Callbreak:Actions" );

export const getGame = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { gameId: v.string() } ) )
	.middleware( [ requireAuthInfo, requireGame( CallbreakEngine.NAME ) ] )
	.handler( async ( { context: { authInfo, game } } ) => {
		logger.debug( ">> getGame()" );

		const stub = getCallbreakStub( game.id );
		const { config, players, state, status, context } = await stub.getPlayerGameInfo( authInfo.id );

		logger.debug( "<< getGame()" );
		return { id: game.id, code: game.code, config, players, state, status, context };
	} );

export const createGame = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		dealCount: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 10 ) ),
		trumpSuit: v.picklist( Object.values( CARD_SUITS ) )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { dealCount, trumpSuit }, context: { authInfo } } ) => {
		logger.debug( ">> createGame()" );

		const [ game ] = await db.insert( games ).values( { game: SplendorEngine.NAME } ).returning();
		const config = { playerCount: 4, dealCount, trumpSuit };

		const stub = getCallbreakStub( game.id );
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
			where: and( eq( games.code, code ), eq( games.game, CallbreakEngine.NAME ) )
		} );

		if ( !game ) {
			logger.error( "Game not found!" );
			throw new Response( null, { status: 404 } );
		}

		const stub = getCallbreakStub( game.id );
		await stub.join( authInfo );

		logger.debug( "<< joinGame()" );
		return game.id;
	} );

export const addBots = createServerFn( { method: "POST" } )
	.inputValidator( v.object( { gameId: v.string() } ) )
	.middleware( [ requireAuthInfo, requireGame( CallbreakEngine.NAME ) ] )
	.handler( async ( { data: { gameId } } ) => {
		logger.debug( ">> addBots()" );

		const stub = getCallbreakStub( gameId );
		await stub.addBots();

		logger.debug( "<< addBots()" );
	} );

export const declareWins = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		gameId: v.string(),
		wins: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 13 ) ),
		dealId: v.string()
	} ) )
	.middleware( [ requireAuthInfo, requireGame( CallbreakEngine.NAME ) ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> declareWins()" );

		const stub = getCallbreakStub( input.gameId );
		await stub.processMove( authInfo.id, "declareWins", input );

		logger.debug( "<< declareWins()" );
	} );

export const playCard = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		gameId: v.string(),
		cardId: v.picklist( SORTED_DECK ),
		dealId: v.string()
	} ) )
	.middleware( [ requireAuthInfo, requireGame( CallbreakEngine.NAME ) ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> playCard()" );

		const stub = getCallbreakStub( input.gameId );
		await stub.processMove( authInfo.id, "playCard", input );

		logger.debug( "<< playCard()" );
	} );
