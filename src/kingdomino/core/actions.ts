"use server";

import { KingdominoEngine } from "@/kingdomino/core/engine";
import type {
	CreateGameInput,
	DiscardDominoInput,
	PlaceDominoInput,
	SelectDominoInput
} from "@/kingdomino/core/types";
import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import type { GameId, GameIdInput, JoinGameInput } from "@/shared/engine/types";
import { createLogger } from "@/shared/utils/logger";
import { getAuthInfo, requireGame, requireGameByCode, validate } from "@/shared/utils/middlewares";
import { env } from "cloudflare:workers";
import { serverAction, serverQuery } from "rwsdk/worker";
import * as v from "valibot";

const logger = createLogger( "Kingdomino:Actions" );

function getStub( gameId: GameId ) {
	const durableObjectId = env.KINGDOMINO_ENGINE.idFromName( `${ KingdominoEngine.NAME }:${ gameId }` );
	return env.KINGDOMINO_ENGINE.get( durableObjectId );
}

export const getGame = serverQuery( [
	validate( v.object( { gameId: v.string() } ) ),
	async ( input: GameIdInput ) => {
		logger.debug( ">> getGame()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( KingdominoEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		const { config, players, state, status, context } = await stub.getPlayerGameInfo( authInfo.id );

		logger.debug( "<< getGame()" );
		return { id: game.id, code: game.code, config, players, state, status, context };
	}
] );

export const createGame = serverAction( [
	validate( v.object( {
		playerCount: v.picklist( [ 2, 3, 4 ] ),
		boardSize: v.picklist( [ 5, 7 ] )
	} ) ),
	async ( input: CreateGameInput ) => {
		logger.debug( ">> createGame()" );

		const authInfo = getAuthInfo();
		const [ game ] = await db.insert( games ).values( { game: KingdominoEngine.NAME } ).returning();

		const stub = getStub( game.id );
		await stub.initialize( game.id, game.code, {
			playerCount: input.playerCount,
			boardSize: input.boardSize,
			autoStart: true
		} );
		await stub.join( authInfo );

		logger.debug( "<< createGame()" );
		return game.id;
	}
] );

export const joinGame = serverAction( [
	validate( v.object( { code: v.string() } ) ),
	async ( input: JoinGameInput ) => {
		logger.debug( ">> joinGame()" );

		const authInfo = getAuthInfo();
		const game = await requireGameByCode( KingdominoEngine.NAME, input.code );
		const stub = getStub( game.id );
		await stub.join( authInfo );

		logger.debug( "<< joinGame()" );
		return game.id;
	}
] );

export const addBots = serverAction( [
	validate( v.object( { gameId: v.string() } ) ),
	async ( input: GameIdInput ) => {
		logger.debug( ">> addBots()" );

		getAuthInfo();
		const game = await requireGame( KingdominoEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.addBots();

		logger.debug( "<< addBots()" );
	}
] );

export const selectDomino = serverAction( [
	validate( v.object( {
		gameId: v.string(),
		dominoId: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 48 ) )
	} ) ),
	async ( input: SelectDominoInput ) => {
		logger.debug( ">> selectDomino()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( KingdominoEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.processMove( authInfo.id, "selectDomino", input );

		logger.debug( "<< selectDomino()" );
	}
] );

export const placeDomino = serverAction( [
	validate( v.object( {
		gameId: v.string(),
		placement: v.object( {
			dominoId: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 48 ) ),
			coord: v.object( {
				x: v.number(),
				y: v.number()
			} ),
			rotation: v.picklist( [ 0, 90, 180, 270 ] )
		} )
	} ) ),
	async ( input: PlaceDominoInput ) => {
		logger.debug( ">> placeDomino()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( KingdominoEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.processMove( authInfo.id, "placeDomino", input );

		logger.debug( "<< placeDomino()" );
	}
] );

export const discardDomino = serverAction( [
	validate( v.object( {
		gameId: v.string(),
		dominoId: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 48 ) )
	} ) ),
	async ( input: DiscardDominoInput ) => {
		logger.debug( ">> discardDomino()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( KingdominoEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.processMove( authInfo.id, "discardDomino", input );

		logger.debug( "<< discardDomino()" );
	}
] );
