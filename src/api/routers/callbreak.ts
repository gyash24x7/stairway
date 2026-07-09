import { CallbreakEngine } from "@/callbreak/core/engine";
import type {
	CallbreakConfig,
	CallbreakPlayerView,
	CallbreakSharedView
} from "@/callbreak/core/types";
import { getCompletedGame, requireGame, requireGameByCode } from "@/api/helpers";
import { authed } from "@/api/middleware";
import { db } from "@/shared/db/client";
import { games } from "@/shared/db/schema";
import { CARD_SUITS, SORTED_DECK } from "@/shared/utils/cards";
import { createLogger } from "@/shared/utils/logger";
import * as v from "valibot";

const logger = createLogger( "Callbreak:Router" );

/** Resolves the Callbreak engine Durable Object stub for a game id. */
function getStub( env: Env, gameId: string ) {
	const name = `${ CallbreakEngine.NAME }:${ gameId }`;
	return env.CALLBREAK_ENGINE.get( env.CALLBREAK_ENGINE.idFromName( name ) );
}

/** Fetches the current Callbreak game state for the authenticated player. */
export const getGame = authed
	.input( v.object( { gameId: v.string() } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> getGame()" );

		const game = await requireGame( CallbreakEngine.NAME, input.gameId );

		if ( game.completed ) {
			const { shared, playerViews } = await getCompletedGame<
				CallbreakSharedView, CallbreakConfig, CallbreakPlayerView
			>( context.env, CallbreakEngine.NAME, game.id );
			logger.debug( "<< getGame() [completed]" );
			return { shared, player: playerViews[ context.user.id ] };
		}

		const stub = getStub( context.env, game.id );
		const { shared, player } = await stub.getPlayerGameInfo( context.user.id );

		logger.debug( "<< getGame()" );
		return { shared, player };
	} );

/** Creates a new Callbreak game with the specified deal count and trump suit. */
export const createGame = authed
	.input( v.object( {
		dealCount: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 10 ) ),
		trumpSuit: v.picklist( Object.values( CARD_SUITS ) )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> createGame()" );

		const [ game ] = await db.insert( games )
			.values( { game: CallbreakEngine.NAME } )
			.returning();

		const stub = getStub( context.env, game.id );
		await stub.initialize( game.id, game.code, {
			playerCount: 4,
			autoStart: true,
			dealCount: input.dealCount,
			trumpSuit: input.trumpSuit
		} );
		await stub.join( context.user );

		logger.debug( "<< createGame()" );
		return game.id;
	} );

/** Joins an existing Callbreak game by its join code. */
export const joinGame = authed
	.input( v.object( { code: v.string() } ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> joinGame()" );

		const game = await requireGameByCode( CallbreakEngine.NAME, input.code );
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

		const game = await requireGame( CallbreakEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.addBots();

		logger.debug( "<< addBots()" );
	} );

/** Declares the number of tricks a player expects to win in the current deal. */
export const declareWins = authed
	.input( v.object( {
		gameId: v.string(),
		dealId: v.string(),
		wins: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 13 ) )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> declareWins()" );

		const game = await requireGame( CallbreakEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.processMove( context.user.id, "declareWins", input );

		logger.debug( "<< declareWins()" );
	} );

/** Plays a card in the current trick. */
export const playCard = authed
	.input( v.object( {
		gameId: v.string(),
		dealId: v.string(),
		cardId: v.picklist( SORTED_DECK )
	} ) )
	.handler( async ( { input, context } ) => {
		logger.debug( ">> playCard()" );

		const game = await requireGame( CallbreakEngine.NAME, input.gameId );
		const stub = getStub( context.env, game.id );
		await stub.processMove( context.user.id, "playCard", input );

		logger.debug( "<< playCard()" );
	} );
