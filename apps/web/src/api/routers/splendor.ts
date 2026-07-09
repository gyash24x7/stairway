import { getCompletedGame, requireGame, requireGameByCode } from "@s2h/api/helpers";
import { authed } from "@s2h/api/middleware";
import { db } from "@s2h/db";
import { games } from "@s2h/db/schema";
import { createLogger } from "@s2h/shared/utils/logger";
import { SplendorEngine } from "@/splendor/core/engine";
import type {
	SplendorConfig,
	SplendorPlayerView,
	SplendorSharedView
} from "@/splendor/core/types";
import { GEMS } from "@/splendor/core/utils";
import * as v from "valibot";

const logger = createLogger( "Splendor:Router" );

/** Resolves the Splendor engine Durable Object stub for a game id. */
function getStub( env: Env, gameId: string ) {
	const name = `${ SplendorEngine.NAME }:${ gameId }`;
	return env.SPLENDOR_ENGINE.get( env.SPLENDOR_ENGINE.idFromName( name ) );
}

/** Fetches the current Splendor game state for the authenticated player. */
export const getGame = authed
	.input( v.object( { gameId: v.string() } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> getGame()" );

		const game = await requireGame( SplendorEngine.NAME, input.gameId );

		if ( game.completed ) {
			const { shared, playerViews } = await getCompletedGame<
				SplendorSharedView, SplendorConfig, SplendorPlayerView
			>( context.env, SplendorEngine.NAME, game.id );
			logger.debug( "<< getGame() [completed]" );
			return { shared, player: playerViews[ context.user.id ] };
		}

		const stub = getStub( context.env, game.id );
		const { shared, player } = await stub.getPlayerGameInfo( context.user.id );

		logger.debug( "<< getGame()" );
		return { shared, player };
	} );

/** Creates a new Splendor game and returns its id. */
export const createGame = authed
	.input( v.object( {
		playerCount: v.pipe( v.number(), v.integer(), v.picklist( [ 2, 3, 4 ] ) ),
		winningPoints: v.pipe( v.number(), v.integer(), v.minValue( 1 ) )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> createGame()" );

		const [ game ] = await db.insert( games )
			.values( { game: SplendorEngine.NAME } )
			.returning();

		const stub = getStub( context.env, game.id );
		await stub.initialize( game.id, game.code, { ...input, autoStart: true } );
		await stub.join( context.user );

		logger.debug( "<< createGame()" );
		return game.id;
	} );

/** Joins an existing Splendor game by its join code and returns its id. */
export const joinGame = authed
	.input( v.object( { code: v.string() } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> joinGame()" );

		const game = await requireGameByCode( SplendorEngine.NAME, input.code );
		const stub = getStub( context.env, game.id );
		await stub.join( context.user );

		logger.debug( "<< joinGame()" );
		return game.id;
	} );

/** Picks gem tokens for the current Splendor game. */
export const pickTokens = authed
	.input( v.object( {
		gameId: v.string(),
		tokens: v.record( v.picklist( GEMS ), v.number() ),
		returned: v.optional( v.record( v.picklist( GEMS ), v.number() ) )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> pickTokens()" );

		const game = await requireGame( SplendorEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.processMove( context.user.id, "pickTokens", input );

		logger.debug( "<< pickTokens()" );
	} );

/** Reserves a development card in the current Splendor game. */
export const reserveCard = authed
	.input( v.object( {
		gameId: v.string(),
		cardId: v.string(),
		withGold: v.boolean(),
		returnedToken: v.optional( v.picklist( GEMS ) )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> reserveCard()" );

		const game = await requireGame( SplendorEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.processMove( context.user.id, "reserveCard", input );

		logger.debug( "<< reserveCard()" );
	} );

/** Purchases a development card in the current Splendor game. */
export const purchaseCard = authed
	.input( v.object( {
		gameId: v.string(),
		cardId: v.string(),
		payment: v.record( v.string(), v.number() )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> purchaseCard()" );

		const game = await requireGame( SplendorEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.processMove( context.user.id, "purchaseCard", input );

		logger.debug( "<< purchaseCard()" );
	} );
