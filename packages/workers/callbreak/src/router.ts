import { ORPCError, os, type RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { CARD_IDS, CARD_SUITS } from "@s2h/utils/cards";
import { createLogger } from "@s2h/utils/logger";
import { length, ltValue, number, object, optional, picklist, pipe, string, trim, ulid } from "valibot";
import type { Context } from "./types.ts";

const logger = createLogger( "Callbreak:Router" );

async function loadEngine( gameId: string, context: Context ) {
	const key = await context.env.CALLBREAK_KV.get( `gameId:${ gameId }` );
	if ( !key ) {
		logger.error( "No Durable Object ID found for gameId:", gameId );
		throw new ORPCError( "NOT_FOUND", { message: "Game not found." } );
	}

	const durableObjectId = context.env.CALLBREAK_DO.idFromString( key );
	return context.env.CALLBREAK_DO.get( durableObjectId );
}

const base = os.$context<Context>();

const createGame = base
	.input( object( {
		dealCount: optional( pipe( number(), picklist( [ 5, 9, 13 ] ) ) ),
		trumpSuit: picklist( Object.values( CARD_SUITS ) ),
		gameId: optional( pipe( string(), ulid() ) )
	} ) )
	.handler( async ( { context, input } ) => {
		const durableObjectId = context.env.CALLBREAK_DO.newUniqueId();
		const engine = context.env.CALLBREAK_DO.get( durableObjectId );
		const { data: gameId } = await engine.initialize( input, context.authInfo );
		return { gameId };
	} );

const getGameData = base
	.input( object( { gameId: pipe( string(), ulid() ) } ) )
	.handler( async ( { context, input } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { data, error } = await engine.getPlayerData( context.authInfo.id );

		if ( error || !data ) {
			logger.error( "Error fetching player data:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to fetch player data." } );
		}

		return data;
	} );

const joinGame = base
	.input( object( { code: pipe( string(), trim(), length( 6 ) ) } ) )
	.handler( async ( { context, input } ) => {
		const key = await context.env.CALLBREAK_KV.get( `code:${ input.code }` );
		if ( !key ) {
			logger.error( "No game found for code:", input.code );
			throw new ORPCError( "NOT_FOUND", { message: "Game not found." } );
		}

		const durableObjectId = context.env.CALLBREAK_DO.idFromString( key );
		const engine = context.env.CALLBREAK_DO.get( durableObjectId );
		const { data: gameId, error } = await engine.addPlayer( context.authInfo );

		if ( error ) {
			logger.error( "Error joining game:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to join game." } );
		}

		return { gameId };
	} );

const addBots = base
	.input( object( { gameId: pipe( string(), ulid() ) } ) )
	.handler( async ( { context, input } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { error } = await engine.addBots( context.authInfo );

		if ( error ) {
			logger.error( "Error adding bots:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to add bots." } );
		}
	} );

const declareDealWins = base
	.input( object( {
		gameId: pipe( string(), ulid() ),
		wins: pipe( number(), ltValue( 13 ) ),
		dealId: pipe( string(), ulid() )
	} ) )
	.handler( async ( { input, context } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { error } = await engine.declareDealWins( input, context.authInfo );

		if ( error ) {
			logger.error( "Error declaring deal wins:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to declare deal wins." } );
		}
	} );


const playCard = base
	.input( object( {
		gameId: pipe( string(), ulid() ),
		cardId: picklist( CARD_IDS ),
		roundId: pipe( string(), ulid() ),
		dealId: pipe( string(), ulid() )
	} ) )
	.handler( async ( { context, input } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { error } = await engine.playCard( input, context.authInfo );

		if ( error ) {
			logger.error( "Error playing card:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to play card." } );
		}
	} );

export const callbreak = base.router( { createGame, getGameData, joinGame, addBots, declareDealWins, playCard } );
export const handler = new RPCHandler( callbreak );

export type CallbreakRouter = typeof callbreak;
export type CallbreakClient = RouterClient<CallbreakRouter>;