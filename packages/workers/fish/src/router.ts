import { ORPCError, os, type RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { CARD_IDS } from "@s2h/utils/cards";
import { createLogger } from "@s2h/utils/logger";
import { array, length, object, picklist, pipe, record, string, trim, ulid } from "valibot";
import type { Context } from "./types.ts";

const logger = createLogger( "Fish:Router" );

async function loadEngine( gameId: string, context: Context ) {
	const key = await context.env.FISH_KV.get( `gameId:${ gameId }` );
	if ( !key ) {
		logger.error( "No Durable Object ID found for gameId:", gameId );
		throw new ORPCError( "NOT_FOUND", { message: "Game not found." } );
	}

	const durableObjectId = context.env.FISH_DO.idFromString( key );
	return context.env.FISH_DO.get( durableObjectId );
}

const base = os.$context<Context>();

const createGame = base
	.input( object( {
		playerCount: picklist( [ 3, 4, 6, 8 ] as const ),
		type: picklist( [ "NORMAL", "CANADIAN" ] as const ),
		teamCount: picklist( [ 2, 3, 4 ] as const )
	} ) )
	.handler( async ( { input, context } ) => {
		const durableObjectId = context.env.FISH_DO.newUniqueId();
		const engine = context.env.FISH_DO.get( durableObjectId );
		const { data: gameId, error } = await engine.initialize( input, context.authInfo );

		if ( error ) {
			logger.error( "Error creating game:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to create game." } );
		}

		return { gameId };
	} );

const getGameData = base
	.input( object( { gameId: pipe( string(), ulid() ) } ) )
	.handler( async ( { input, context } ) => {
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
	.handler( async ( { input, context } ) => {
		const key = await context.env.FISH_KV.get( `code:${ input.code }` );
		if ( !key ) {
			logger.error( "No game found for code:", input.code );
			throw new ORPCError( "NOT_FOUND", { message: "Game not found." } );
		}

		const durableObjectId = context.env.FISH_DO.idFromString( key );
		const engine = context.env.FISH_DO.get( durableObjectId );
		const { data: gameId, error } = await engine.addPlayer( context.authInfo );

		if ( error ) {
			logger.error( "Error joining game:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to join game." } );
		}

		return { gameId };
	} );

const addBots = base
	.input( object( { gameId: pipe( string(), ulid() ) } ) )
	.handler( async ( { input, context } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { error } = await engine.addBots( context.authInfo );

		if ( error ) {
			logger.error( "Error adding bots:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to add bots." } );
		}
	} );

const createTeams = base
	.input( object( {
		gameId: pipe( string(), ulid() ),
		teams: record( string(), array( pipe( string(), ulid() ) ) )
	} ) )
	.handler( async ( { input, context } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { error } = await engine.createTeams( input, context.authInfo );

		if ( error ) {
			logger.error( "Error creating teams:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to create teams." } );
		}
	} );

const startGame = base
	.input( object( { gameId: pipe( string(), ulid() ) } ) )
	.handler( async ( { input, context } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { error } = await engine.startGame( context.authInfo );

		if ( error ) {
			logger.error( "Error starting game:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to start game." } );
		}
	} );

const askCard = base
	.input( object( {
		gameId: pipe( string(), ulid() ),
		from: pipe( string(), ulid() ),
		cardId: picklist( CARD_IDS )
	} ) )
	.handler( async ( { input, context } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { error } = await engine.askCard( input, context.authInfo );

		if ( error ) {
			logger.error( "Error asking card:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to ask card" } );
		}
	} );

const claimBook = base
	.input( object( {
		gameId: pipe( string(), ulid() ),
		claim: record( picklist( CARD_IDS ), pipe( string(), ulid() ) )
	} ) )
	.handler( async ( { input, context } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { error } = await engine.claimBook( input, context.authInfo );

		if ( error ) {
			logger.error( "Error claiming book:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to claim book." } );
		}
	} );

const transferTurn = base
	.input( object( { gameId: pipe( string(), ulid() ), transferTo: pipe( string(), ulid() ) } ) )
	.handler( async ( { input, context } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { error } = await engine.transferTurn( input, context.authInfo );

		if ( error ) {
			logger.error( "Error transferring turn:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to transfer turn." } );
		}
	} );

export const fish = base.router( {
	createGame,
	getGameData,
	joinGame,
	addBots,
	createTeams,
	startGame,
	askCard,
	claimBook,
	transferTurn
} );

export const handler = new RPCHandler( fish );

export type FishRouter = typeof fish;
export type FishClient = RouterClient<FishRouter>;