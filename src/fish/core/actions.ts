import { FishEngine } from "@/fish/core/engine";
import { buildConfig } from "@/fish/core/utils";
import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import { SORTED_DECK } from "@/shared/utils/cards";
import { createLogger } from "@/shared/utils/logger";
import { requireAuthInfo, requireGame } from "@/shared/utils/middlewares";
import { getFishStub } from "@/shared/utils/stub";
import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";

const logger = createLogger( "Fish:Actions" );

export const getGame = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { gameId: v.string() } ) )
	.middleware( [ requireAuthInfo, requireGame( FishEngine.NAME ) ] )
	.handler( async ( { context: { authInfo, game } } ) => {
		logger.debug( ">> getGame()" );

		const stub = getFishStub( game.id );
		const { config, players, state, status, context } = await stub.getPlayerGameInfo( authInfo.id );

		logger.debug( "<< getGame()" );
		return { id: game.id, code: game.code, config, players, state, status, context };
	} );

export const createGame = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		playerCount: v.picklist( [ 4, 6, 8 ] ),
		type: v.picklist( [ "NORMAL", "CANADIAN" ] ),
		teamCount: v.picklist( [ 2, 3, 4 ] )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> createGame()" );

		const [ game ] = await db.insert( games ).values( { game: FishEngine.NAME } ).returning();
		const config = buildConfig( input );

		const stub = getFishStub( game.id );
		await stub.initialize( config );
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
			where: and( eq( games.code, code ), eq( games.game, FishEngine.NAME ) )
		} );

		if ( !game ) {
			logger.error( "Game not found!" );
			throw new Response( null, { status: 404 } );
		}

		const stub = getFishStub( game.id );
		await stub.join( authInfo );

		logger.debug( "<< joinGame()" );
		return game.id;
	} );

export const addBots = createServerFn( { method: "POST" } )
	.inputValidator( v.object( { gameId: v.string() } ) )
	.middleware( [ requireAuthInfo, requireGame( FishEngine.NAME ) ] )
	.handler( async ( { data: { gameId } } ) => {
		logger.debug( ">> addBots()" );

		const stub = getFishStub( gameId );
		await stub.addBots();

		logger.debug( "<< addBots()" );
	} );

export const createTeams = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		gameId: v.string(),
		teams: v.record( v.string(), v.array( v.string() ) )
	} ) )
	.middleware( [ requireAuthInfo, requireGame( FishEngine.NAME ) ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> createTeams()" );

		const stub = getFishStub( input.gameId );
		await stub.processMove( authInfo.id, "createTeams", input );
		await stub.start();

		logger.debug( "<< createTeams()" );
	} );

export const askCard = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		gameId: v.string(),
		from: v.string(),
		cardId: v.picklist( SORTED_DECK )
	} ) )
	.middleware( [ requireAuthInfo, requireGame( FishEngine.NAME ) ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> askCard()" );

		const stub = getFishStub( input.gameId );
		await stub.processMove( authInfo.id, "askCard", input );

		logger.debug( "<< askCard()" );
	} );

export const claimBook = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		gameId: v.string(),
		claim: v.record( v.picklist( SORTED_DECK ), v.string() )
	} ) )
	.middleware( [ requireAuthInfo, requireGame( FishEngine.NAME ) ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> claimBook()" );

		const stub = getFishStub( input.gameId );
		await stub.processMove( authInfo.id, "claimBook", input );

		logger.debug( "<< claimBook()" );
	} );

export const transferTurn = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		gameId: v.string(),
		transferTo: v.string()
	} ) )
	.middleware( [ requireAuthInfo, requireGame( FishEngine.NAME ) ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> transferTurn()" );

		const stub = getFishStub( input.gameId );
		await stub.processMove( authInfo.id, "transferTurn", input );

		logger.debug( "<< transferTurn()" );
	} );
