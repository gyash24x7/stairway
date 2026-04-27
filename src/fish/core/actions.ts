"use server";

import { FishEngine } from "@/fish/core/engine";
import type {
	AskCardInput,
	ClaimBookInput,
	CreateGameInput,
	CreateTeamsInput,
	TransferTurnInput
} from "@/fish/core/types";
import { buildConfig } from "@/fish/core/utils";
import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import type { GameId, GameIdInput, JoinGameInput } from "@/shared/engine/types";
import { SORTED_DECK } from "@/shared/utils/cards";
import { createLogger } from "@/shared/utils/logger";
import {
	getAuthInfo,
	getCompletedGame,
	requireGame,
	requireGameByCode,
	validate
} from "@/shared/utils/middlewares";
import { env } from "cloudflare:workers";
import { serverAction, serverQuery } from "rwsdk/worker";
import * as v from "valibot";

const logger = createLogger( "Fish:Actions" );

/**
 * Get a Durable Object stub for a Fish game engine instance.
 *
 * @param gameId - The game ID to look up.
 * @returns The Durable Object stub for the game engine.
 */
function getStub( gameId: GameId ) {
	const name = `${ FishEngine.NAME }:${ gameId }`;
	const durableObjectId = env.FISH_ENGINE.idFromName( name );
	return env.FISH_ENGINE.get( durableObjectId );
}

/** Server query to fetch the current Fish game state for the authenticated player. */
export const getGame = serverQuery( [
	validate( v.object( { gameId: v.string() } ) ),
	async ( input: GameIdInput ) => {
		logger.debug( ">> getGame()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( FishEngine.NAME, input.gameId );

		if ( game.completed ) {
			const { shared, playerViews } = await getCompletedGame( FishEngine.NAME, game.id );
			logger.debug( "<< getGame() [completed]" );
			return { shared, player: playerViews[ authInfo.id ] };
		}

		const stub = getStub( game.id );
		const { shared, player } = await stub.getPlayerGameInfo( authInfo.id );

		logger.debug( "<< getGame()" );
		return { shared, player };
	}
] );

/** Server action to create a new Fish game with player count, variant, and team count. */
export const createGame = serverAction( [
	validate( v.object( {
		playerCount: v.picklist( [ 4, 6, 8 ] ),
		type: v.picklist( [ "NORMAL", "CANADIAN" ] ),
		teamCount: v.picklist( [ 2, 3, 4 ] )
	} ) ),
	async ( input: CreateGameInput ) => {
		logger.debug( ">> createGame()" );

		const authInfo = getAuthInfo();
		const [ game ] = await db.insert( games ).values( { game: FishEngine.NAME } ).returning();
		const config = buildConfig( input.playerCount, input.type, input.teamCount );

		const stub = getStub( game.id );
		await stub.initialize( game.id, game.code, config );
		await stub.join( authInfo );

		logger.debug( "<< createGame()" );
		return game.id;
	}
] );

/** Server action to join an existing Fish game by its join code. */
export const joinGame = serverAction( [
	validate( v.object( { code: v.string() } ) ),
	async ( input: JoinGameInput ) => {
		logger.debug( ">> joinGame()" );

		const authInfo = getAuthInfo();
		const game = await requireGameByCode( FishEngine.NAME, input.code );
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
		const game = await requireGame( FishEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.addBots();

		logger.debug( "<< addBots()" );
	}
] );

/** Server action to create team assignments for the game. */
export const createTeams = serverAction( [
	validate( v.object( {
		gameId: v.string(),
		teams: v.record( v.string(), v.array( v.string() ) )
	} ) ),
	async ( input: CreateTeamsInput ) => {
		logger.debug( ">> createTeams()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( FishEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.processMove( authInfo.id, "createTeams", input );

		logger.debug( "<< createTeams()" );
	}
] );

/** Server action to ask an opponent for a specific card. */
export const askCard = serverAction( [
	validate( v.object( {
		gameId: v.string(),
		from: v.string(),
		cardId: v.picklist( SORTED_DECK )
	} ) ),
	async ( input: AskCardInput ) => {
		logger.debug( ">> askCard()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( FishEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.processMove( authInfo.id, "askCard", input );

		logger.debug( "<< askCard()" );
	}
] );

/** Server action to claim a book by declaring who holds each card. */
export const claimBook = serverAction( [
	validate( v.object( {
		gameId: v.string(),
		claim: v.record( v.picklist( SORTED_DECK ), v.string() )
	} ) ),
	async ( input: ClaimBookInput ) => {
		logger.debug( ">> claimBook()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( FishEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.processMove( authInfo.id, "claimBook", input );

		logger.debug( "<< claimBook()" );
	}
] );

/** Server action to transfer the turn to a teammate after a successful claim. */
export const transferTurn = serverAction( [
	validate( v.object( {
		gameId: v.string(),
		transferTo: v.string()
	} ) ),
	async ( input: TransferTurnInput ) => {
		logger.debug( ">> transferTurn()" );

		const authInfo = getAuthInfo();
		const game = await requireGame( FishEngine.NAME, input.gameId );
		const stub = getStub( game.id );
		await stub.processMove( authInfo.id, "transferTurn", input );

		logger.debug( "<< transferTurn()" );
	}
] );
