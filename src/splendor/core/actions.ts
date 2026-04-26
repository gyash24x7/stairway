"use server";

import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import type { GameId, GameIdInput, JoinGameInput } from "@/shared/engine/types";
import { createLogger } from "@/shared/utils/logger";
import { getAuthInfo, requireGame, requireGameByCode, validate } from "@/shared/utils/middlewares";
import { SplendorEngine } from "@/splendor/core/engine";
import type {
	PickTokensInput,
	PurchaseCardInput,
	ReserveCardInput,
	SplendorConfig
} from "@/splendor/core/types";
import { GEMS } from "@/splendor/core/utils";
import { env } from "cloudflare:workers";
import { serverAction, serverQuery } from "rwsdk/worker";
import * as v from "valibot";

const logger = createLogger( "Splendor:Actions" );

function getStub( gameId: GameId ) {
	const name = `${ SplendorEngine.NAME }:${ gameId }`;
	const durableObjectId = env.SPLENDOR_ENGINE.idFromName( name );
	return env.SPLENDOR_ENGINE.get( durableObjectId );
}

export const getGame = serverQuery( [
	validate( v.object( { gameId: v.string() } ) ),
	async ( input: GameIdInput ) => {
		logger.debug( ">> getGame()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( SplendorEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		const { shared, player } = await stub.getPlayerGameInfo( authInfo.id );

		logger.debug( "<< getGame()" );
		return { shared, player };
	}
] );

export const createGame = serverAction( [
	validate( v.object( {
		playerCount: v.pipe( v.number(), v.integer(), v.picklist( [ 2, 3, 4 ] ) ),
		winningPoints: v.pipe( v.number(), v.integer(), v.minValue( 1 ) )
	} ) ),
	async ( input: SplendorConfig ) => {
		logger.debug( ">> createGame()" );

		const authInfo = getAuthInfo();
		const [ game ] = await db.insert( games )
			.values( { game: SplendorEngine.NAME } )
			.returning();

		const stub = getStub( game.id );
		await stub.initialize( game.id, game.code, { ...input, autoStart: true } );
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
		const game = await requireGameByCode( SplendorEngine.NAME, input.code );
		const stub = getStub( game.id );
		await stub.join( authInfo );

		logger.debug( "<< joinGame()" );
		return game.id;
	}
] );

export const pickTokens = serverAction( [
	validate( v.object( {
		gameId: v.string(),
		tokens: v.record( v.picklist( GEMS ), v.number() ),
		returned: v.optional( v.record( v.picklist( GEMS ), v.number() ) )
	} ) ),
	async ( input: PickTokensInput ) => {
		logger.debug( ">> pickTokens()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( SplendorEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.processMove( authInfo.id, "pickTokens", input );

		logger.debug( "<< pickTokens()" );
	}
] );

export const reserveCard = serverAction( [
	validate( v.object( {
		gameId: v.string(),
		cardId: v.string(),
		withGold: v.boolean(),
		returnedToken: v.optional( v.picklist( GEMS ) )
	} ) ),
	async ( input: ReserveCardInput ) => {
		logger.debug( ">> reserveCard()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( SplendorEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.processMove( authInfo.id, "reserveCard", input );

		logger.debug( "<< reserveCard()" );
	}
] );

export const purchaseCard = serverAction( [
	validate( v.object( {
		gameId: v.string(),
		cardId: v.string(),
		payment: v.record( v.string(), v.number() )
	} ) ),
	async ( input: PurchaseCardInput ) => {
		logger.debug( ">> purchaseCard()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( SplendorEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.processMove( authInfo.id, "purchaseCard", input );

		logger.debug( "<< purchaseCard()" );
	}
] );
