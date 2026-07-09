import { getCompletedGame, requireGame, requireGameByCode } from "@/api/helpers";
import { authed } from "@/api/middleware";
import { FishEngine } from "@/fish/core/engine";
import type { FishConfig, FishPlayerView, FishSharedView } from "@/fish/core/types";
import { buildConfig } from "@/fish/core/utils";
import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import { SORTED_DECK } from "@/shared/utils/cards";
import { createLogger } from "@/shared/utils/logger";
import * as v from "valibot";

const logger = createLogger( "Fish:Router" );

/** Resolves the Fish engine Durable Object stub for a game id. */
function getStub( env: Env, gameId: string ) {
	const name = `${ FishEngine.NAME }:${ gameId }`;
	return env.FISH_ENGINE.get( env.FISH_ENGINE.idFromName( name ) );
}

/** Fetches the current Fish game state for the authenticated player. */
export const getGame = authed
	.input( v.object( { gameId: v.string() } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> getGame()" );

		const game = await requireGame( FishEngine.NAME, input.gameId );

		if ( game.completed ) {
			const { shared, playerViews } = await getCompletedGame<
				FishSharedView, FishConfig, FishPlayerView
			>( context.env, FishEngine.NAME, game.id );
			logger.debug( "<< getGame() [completed]" );
			return { shared, player: playerViews[ context.user.id ] };
		}

		const stub = getStub( context.env, game.id );
		const { shared, player } = await stub.getPlayerGameInfo( context.user.id );

		logger.debug( "<< getGame()" );
		return { shared, player };
	} );

/** Creates a new Fish game with player count, variant, and team count and returns its id. */
export const createGame = authed
	.input( v.object( {
		playerCount: v.picklist( [ 4, 6, 8 ] ),
		type: v.picklist( [ "NORMAL", "CANADIAN" ] ),
		teamCount: v.picklist( [ 2, 3, 4 ] )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> createGame()" );

		const [ game ] = await db.insert( games ).values( { game: FishEngine.NAME } ).returning();
		const config = buildConfig( input.playerCount, input.type, input.teamCount );

		const stub = getStub( context.env, game.id );
		await stub.initialize( game.id, game.code, config );
		await stub.join( context.user );

		logger.debug( "<< createGame()" );
		return game.id;
	} );

/** Joins an existing Fish game by its join code and returns its id. */
export const joinGame = authed
	.input( v.object( { code: v.string() } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> joinGame()" );

		const game = await requireGameByCode( FishEngine.NAME, input.code );
		const stub = getStub( context.env, game.id );
		await stub.join( context.user );

		logger.debug( "<< joinGame()" );
		return game.id;
	} );

/** Fills remaining player slots with bot players. */
export const addBots = authed
	.input( v.object( { gameId: v.string() } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> addBots()" );

		const game = await requireGame( FishEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.addBots();

		logger.debug( "<< addBots()" );
	} );

/** Creates team assignments for the game. */
export const createTeams = authed
	.input( v.object( {
		gameId: v.string(),
		teams: v.record( v.string(), v.array( v.string() ) )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> createTeams()" );

		const game = await requireGame( FishEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.processMove( context.user.id, "createTeams", input );

		logger.debug( "<< createTeams()" );
	} );

/** Asks an opponent for a specific card. */
export const askCard = authed
	.input( v.object( {
		gameId: v.string(),
		from: v.string(),
		cardId: v.picklist( SORTED_DECK )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> askCard()" );

		const game = await requireGame( FishEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.processMove( context.user.id, "askCard", input );

		logger.debug( "<< askCard()" );
	} );

/** Claims a book by declaring who holds each card. */
export const claimBook = authed
	.input( v.object( {
		gameId: v.string(),
		claim: v.record( v.picklist( SORTED_DECK ), v.string() )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> claimBook()" );

		const game = await requireGame( FishEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.processMove( context.user.id, "claimBook", input );

		logger.debug( "<< claimBook()" );
	} );

/** Transfers the turn to a teammate after a successful claim. */
export const transferTurn = authed
	.input( v.object( {
		gameId: v.string(),
		transferTo: v.string()
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> transferTurn()" );

		const game = await requireGame( FishEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.processMove( context.user.id, "transferTurn", input );

		logger.debug( "<< transferTurn()" );
	} );
