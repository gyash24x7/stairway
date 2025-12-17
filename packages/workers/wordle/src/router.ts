import { ORPCError, os, type RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { createLogger } from "@s2h/utils/logger";
import { gtValue, nonEmpty, number, object, optional, picklist, pipe, string, ulid } from "valibot";
import type { Context } from "./types.ts";

const logger = createLogger( "Wordle:Router" );

async function loadEngine( gameId: string, context: Context ) {
	const key = await context.env.WORDLE_KV.get( `gameId:${ gameId }` );
	if ( !key ) {
		logger.error( "No Durable Object ID found for gameId:", gameId );
		throw new ORPCError( "NOT_FOUND", { message: "Game not found." } );
	}

	const durableObjectId = context.env.WORDLE_DO.idFromString( key );
	return context.env.WORDLE_DO.get( durableObjectId );
}

const base = os.$context<Context>();

const createGame = base
	.input( object( {
		wordCount: optional( pipe( number(), gtValue( 0 ) ) ),
		wordLength: optional( picklist( [ 4, 5, 6 ] ) )
	} ) )
	.handler( async ( { input, context } ) => {
		const durableObjectId = context.env.WORDLE_DO.newUniqueId();
		const engine = context.env.WORDLE_DO.get( durableObjectId );
		const { data: gameId } = await engine.initialize( input, context.authInfo.id );
		return { gameId };
	} );

const getGameData = base
	.input( object( { gameId: pipe( string(), ulid() ) } ) )
	.handler( async ( { input, context } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { data, error } = await engine.getPlayerData( context.authInfo.id );
		if ( error ) {
			logger.error( "Error fetching player data:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to fetch player data." } );
		}
		return data;
	} );

const getWords = base
	.input( object( { gameId: pipe( string(), ulid() ) } ) )
	.handler( async ( { input, context } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { data: words, error } = await engine.getWords( context.authInfo.id );
		if ( error ) {
			logger.error( "Error fetching words:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to fetch words." } );
		}
		return { words };
	} );

const makeGuess = base
	.input( object( { gameId: pipe( string(), ulid() ), guess: pipe( string(), nonEmpty() ) } ) )
	.handler( async ( { input, context } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { data, error } = await engine.makeGuess( { guess: input.guess }, context.authInfo.id );
		if ( error ) {
			logger.error( "Error making guess:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to make guess." } );
		}
		return data;
	} );

export const wordle = base.router( { createGame, getGameData, getWords, makeGuess } );
export const handler = new RPCHandler( wordle );

export type WordleRouter = typeof wordle;
export type WordleClient = RouterClient<WordleRouter>;