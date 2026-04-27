"use server";

import { CallbreakEngine } from "@/callbreak/core/engine";
import type { CreateGameInput, DeclareWinsInput, PlayCardInput } from "@/callbreak/core/types";
import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import type { GameId, GameIdInput, JoinGameInput } from "@/shared/engine/types";
import { CARD_SUITS, SORTED_DECK } from "@/shared/utils/cards";
import { createLogger } from "@/shared/utils/logger";
import { getAuthInfo, getCompletedGame, requireGame, requireGameByCode, validate } from "@/shared/utils/middlewares";
import { env } from "cloudflare:workers";
import { serverAction, serverQuery } from "rwsdk/worker";
import * as v from "valibot";

const logger = createLogger( "Callbreak:Actions" );

/**
 * Get a Durable Object stub for a Callbreak game engine instance.
 *
 * @param gameId - The game ID to look up.
 * @returns The Durable Object stub for the game engine.
 */
function getStub( gameId: GameId ) {
	const name = `${ CallbreakEngine.NAME }:${ gameId }`;
	const durableObjectId = env.CALLBREAK_ENGINE.idFromName( name );
	return env.CALLBREAK_ENGINE.get( durableObjectId );
}

/** Server query to fetch the current game state for the authenticated player. */
export const getGame = serverQuery( [
	validate( v.object( { gameId: v.string() } ) ),
	async ( input: GameIdInput ) => {
		logger.debug( ">> getGame()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( CallbreakEngine.NAME, input.gameId );

		if ( game.completed ) {
			const { shared, playerViews } = await getCompletedGame( CallbreakEngine.NAME, game.id );
			logger.debug( "<< getGame() [completed]" );
			return { shared, player: playerViews[ authInfo.id ] };
		}

		const stub = getStub( game.id );
		const { shared, player } = await stub.getPlayerGameInfo( authInfo.id );

		logger.debug( "<< getGame()" );
		return { shared, player };
	}
] );

/** Server action to create a new Callbreak game with the specified deal count and trump suit. */
export const createGame = serverAction( [
	validate( v.object( {
		dealCount: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 10 ) ),
		trumpSuit: v.picklist( Object.values( CARD_SUITS ) )
	} ) ),
	async ( input: CreateGameInput ) => {
		logger.debug( ">> createGame()" );

		const authInfo = getAuthInfo();
		const [ game ] = await db.insert( games )
			.values( { game: CallbreakEngine.NAME } )
			.returning();

		const stub = getStub( game.id );
		await stub.initialize( game.id, game.code, {
			playerCount: 4,
			autoStart: true,
			dealCount: input.dealCount,
			trumpSuit: input.trumpSuit
		} );
		await stub.join( authInfo );

		logger.debug( "<< createGame()" );
		return game.id;
	}
] );

/** Server action to join an existing Callbreak game by its join code. */
export const joinGame = serverAction( [
	validate( v.object( { code: v.string() } ) ),
	async ( input: JoinGameInput ) => {
		logger.debug( ">> joinGame()" );

		const authInfo = getAuthInfo();
		const game = await requireGameByCode( CallbreakEngine.NAME, input.code );
		const stub = getStub( game.id );
		await stub.join( authInfo );

		logger.debug( "<< joinGame()" );
		return game.id;
	}
] );

/** Server action to fill remaining player slots with bot players. */
export const addBots = serverAction( [
	validate( v.object( { gameId: v.string() } ) ),
	async ( input: GameIdInput ) => {
		logger.debug( ">> addBots()" );

		getAuthInfo();
		const game = await requireGame( CallbreakEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.addBots();

		logger.debug( "<< addBots()" );
	}
] );

/** Server action to declare the number of tricks a player expects to win in the current deal. */
export const declareWins = serverAction( [
	validate( v.object( {
		gameId: v.string(),
		dealId: v.string(),
		wins: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 13 ) )
	} ) ),
	async ( input: DeclareWinsInput ) => {
		logger.debug( ">> declareWins()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( CallbreakEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.processMove( authInfo.id, "declareWins", input );

		logger.debug( "<< declareWins()" );
	}
] );

/** Server action to play a card in the current trick. */
export const playCard = serverAction( [
	validate( v.object( {
		gameId: v.string(),
		dealId: v.string(),
		cardId: v.picklist( SORTED_DECK )
	} ) ),
	async ( input: PlayCardInput ) => {
		logger.debug( ">> playCard()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( CallbreakEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.processMove( authInfo.id, "playCard", input );

		logger.debug( "<< playCard()" );
	}
] );
