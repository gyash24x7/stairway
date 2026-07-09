import { getCompletedGame, requireGame, requireGameByCode } from "@/api/helpers";
import { authed } from "@/api/middleware";
import { KingdominoEngine } from "@/kingdomino/core/engine";
import type {
	KingdominoConfig,
	KingdominoPlayerView,
	KingdominoSharedView
} from "@/kingdomino/core/types";
import { db } from "@s2h/db";
import { games } from "@s2h/db/schema";
import { createLogger } from "@s2h/shared/utils/logger";
import * as v from "valibot";

const logger = createLogger( "Kingdomino:Router" );

/** Resolves the Kingdomino engine Durable Object stub for a game id. */
function getStub( env: Env, gameId: string ) {
	const name = `${ KingdominoEngine.NAME }:${ gameId }`;
	return env.KINGDOMINO_ENGINE.get( env.KINGDOMINO_ENGINE.idFromName( name ) );
}

/** Fetches the current Kingdomino game state for the authenticated player. */
export const getGame = authed
	.input( v.object( { gameId: v.string() } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> getGame()" );

		const game = await requireGame( KingdominoEngine.NAME, input.gameId );

		if ( game.completed ) {
			const { shared, playerViews } = await getCompletedGame<
				KingdominoSharedView, KingdominoConfig, KingdominoPlayerView
			>( context.env, KingdominoEngine.NAME, game.id );
			logger.debug( "<< getGame() [completed]" );
			return { shared, player: playerViews[ context.user.id ] };
		}

		const stub = getStub( context.env, game.id );
		const { shared, player } = await stub.getPlayerGameInfo( context.user.id );

		logger.debug( "<< getGame()" );
		return { shared, player };
	} );

/** Creates a new Kingdomino game with specified player count and board size. */
export const createGame = authed
	.input( v.object( {
		playerCount: v.picklist( [ 2, 3, 4 ] ),
		boardSize: v.picklist( [ 5, 7 ] )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> createGame()" );

		const [ game ] = await db.insert( games )
			.values( { game: KingdominoEngine.NAME } )
			.returning();

		const stub = getStub( context.env, game.id );
		await stub.initialize( game.id, game.code, {
			playerCount: input.playerCount,
			boardSize: input.boardSize,
			autoStart: true
		} );
		await stub.join( context.user );

		logger.debug( "<< createGame()" );
		return game.id;
	} );

/** Joins an existing Kingdomino game by its join code and returns its id. */
export const joinGame = authed
	.input( v.object( { code: v.string() } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> joinGame()" );

		const game = await requireGameByCode( KingdominoEngine.NAME, input.code );
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

		const game = await requireGame( KingdominoEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.addBots();

		logger.debug( "<< addBots()" );
	} );

/** Selects a domino from the current draft. */
export const selectDomino = authed
	.input( v.object( {
		gameId: v.string(),
		dominoId: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 48 ) )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> selectDomino()" );

		const game = await requireGame( KingdominoEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.processMove( context.user.id, "selectDomino", input );

		logger.debug( "<< selectDomino()" );
	} );

/** Places a domino on the player's board. */
export const placeDomino = authed
	.input( v.object( {
		gameId: v.string(),
		placement: v.object( {
			dominoId: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 48 ) ),
			coord: v.object( {
				x: v.number(),
				y: v.number()
			} ),
			rotation: v.picklist( [ 0, 90, 180, 270 ] )
		} )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> placeDomino()" );

		const game = await requireGame( KingdominoEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.processMove( context.user.id, "placeDomino", input );

		logger.debug( "<< placeDomino()" );
	} );

/** Discards a domino that cannot be legally placed. */
export const discardDomino = authed
	.input( v.object( {
		gameId: v.string(),
		dominoId: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 48 ) )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> discardDomino()" );

		const game = await requireGame( KingdominoEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.processMove( context.user.id, "discardDomino", input );

		logger.debug( "<< discardDomino()" );
	} );
