"use server";

import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import type { GameId, GameIdInput, JoinGameInput } from "@/shared/engine/types";
import { createLogger } from "@/shared/utils/logger";
import { getAuthInfo, requireGame, requireGameByCode, validate } from "@/shared/utils/middlewares";
import { TicTacToeEngine } from "@/tictactoe/core/engine";
import type { PlaceInput } from "@/tictactoe/core/types";
import { env } from "cloudflare:workers";
import { serverAction, serverQuery } from "rwsdk/worker";
import * as v from "valibot";

const logger = createLogger( "TicTacToe:Actions" );

function getStub( gameId: GameId ) {
	const durableObjectId = env.TIC_TAC_TOE_ENGINE.idFromName( `${ TicTacToeEngine.NAME }:${ gameId }` );
	return env.TIC_TAC_TOE_ENGINE.get( durableObjectId );
}

export const getGame = serverQuery( [
	validate( v.object( { gameId: v.string() } ) ),
	async ( input: GameIdInput ) => {
		logger.debug( ">> getGame()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( TicTacToeEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		const { config, players, state, status, context } = await stub.getPlayerGameInfo( authInfo.id );

		logger.debug( "<< getGame()" );
		return { id: game.id, code: game.code, config, players, state, status, context };
	}
] );

export const createGame = serverAction( [
	async () => {
		logger.debug( ">> createGame()" );

		const authInfo = getAuthInfo();
		const [ game ] = await db.insert( games ).values( { game: TicTacToeEngine.NAME } ).returning();

		logger.debug( "Game Created! %s:%s", TicTacToeEngine.NAME, game.id );

		const stub = getStub( game.id );
		await stub.initialize( game.id, game.code, { playerCount: 2, autoStart: true } );
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
		const game = await requireGameByCode( TicTacToeEngine.NAME, input.code );
		const stub = getStub( game.id );
		await stub.join( authInfo );

		logger.debug( "<< joinGame()" );
		return game.id;
	}
] );

export const placeMove = serverAction( [
	validate( v.object( {
		gameId: v.string(),
		position: v.pipe( v.number(), v.integer(), v.minValue( 0 ), v.maxValue( 8 ) )
	} ) ),
	async ( input: PlaceInput ) => {
		logger.debug( ">> placeMove()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( TicTacToeEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.processMove( authInfo.id, "place", input );

		logger.debug( "<< placeMove()" );
	}
] );

export const addBots = serverAction( [
	validate( v.object( { gameId: v.string() } ) ),
	async ( input: GameIdInput ) => {
		logger.debug( ">> addBots()" );

		getAuthInfo();
		const game = await requireGame( TicTacToeEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.addBots();

		logger.debug( "<< addBots()" );
	}
] );
