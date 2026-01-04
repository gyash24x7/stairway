import { ORPCError, os, type RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { createLogger } from "@s2h/utils/logger";
import { boolean, custom, length, number, object, picklist, pipe, record, string, trim, ulid, void_ } from "valibot";
import type { Context, PlayerGameInfo } from "./types.ts";

const logger = createLogger( "Splendor:Router" );

async function loadEngine( gameId: string, context: Context ) {
	const key = await context.env.SPLENDOR_KV.get( `gameId:${ gameId }` );
	if ( !key ) {
		logger.error( "No Durable Object ID found for gameId:", gameId );
		throw new ORPCError( "NOT_FOUND", { message: "Game not found." } );
	}

	const durableObjectId = context.env.SPLENDOR_DO.idFromString( key );
	return context.env.SPLENDOR_DO.get( durableObjectId );
}

const base = os.$context<Context>();

const createGame = base
	.input( object( { playerCount: picklist( [ 2, 3, 4 ] as const ) } ) )
	.output( object( { gameId: pipe( string(), ulid() ) } ) )
	.handler( async ( { input, context } ) => {
		const durableObjectId = context.env.SPLENDOR_DO.newUniqueId();
		const engine = context.env.SPLENDOR_DO.get( durableObjectId );
		const { data: gameId, error } = await engine.initialize( input, context.authInfo );

		if ( error || !gameId ) {
			logger.error( "Error creating game:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to create game." } );
		}

		return { gameId };
	} );

const getGameData = base
	.input( object( { gameId: pipe( string(), ulid() ) } ) )
	.output( custom<PlayerGameInfo>( () => true ) )
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
	.output( object( { gameId: pipe( string(), ulid() ) } ) )
	.handler( async ( { input, context } ) => {
		const key = await context.env.SPLENDOR_KV.get( `code:${ input.code }` );
		if ( !key ) {
			logger.error( "No game found for code:", input.code );
			throw new ORPCError( "NOT_FOUND", { message: "Game not found." } );
		}

		const durableObjectId = context.env.SPLENDOR_DO.idFromString( key );
		const engine = context.env.SPLENDOR_DO.get( durableObjectId );
		const { data: gameId, error } = await engine.addPlayer( context.authInfo );

		if ( error || !gameId ) {
			logger.error( "Error joining game:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to join game." } );
		}

		return { gameId };
	} );

const addBots = base
	.input( object( { gameId: pipe( string(), ulid() ) } ) )
	.output( void_() )
	.handler( async ( { input, context } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { error } = await engine.addBots( context.authInfo );

		if ( error ) {
			logger.error( "Error adding bots:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to add bots." } );
		}
	} );

const startGame = base
	.input( object( { gameId: pipe( string(), ulid() ) } ) )
	.output( void_() )
	.handler( async ( { input, context } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { error } = await engine.startGame( context.authInfo );

		if ( error ) {
			logger.error( "Error starting game:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to start game." } );
		}
	} );

const pickTokens = base
	.input( object( {
		gameId: pipe( string(), ulid() ),
		tokens: record( picklist( [ "diamond", "sapphire", "emerald", "ruby", "onyx", "gold" ] ), number() )
	} ) )
	.output( void_() )
	.handler( async ( { input, context } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { error } = await engine.pickTokens( input, context.authInfo );

		if ( error ) {
			logger.error( "Error picking tokens:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to pick tokens" } );
		}
	} );

const purchaseCard = base
	.input( object( {
		gameId: pipe( string(), ulid() ),
		cardId: pipe( string() ),
		payment: record( picklist( [ "diamond", "sapphire", "emerald", "ruby", "onyx", "gold" ] ), number() )
	} ) )
	.output( void_() )
	.handler( async ( { input, context } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { error } = await engine.purchaseCard( input, context.authInfo );

		if ( error ) {
			logger.error( "Error purchasing card:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to purchse card." } );
		}
	} );

const reserveCard = base
	.input( object( {
		gameId: pipe( string(), ulid() ),
		cardId: string(),
		withGold: boolean()
	} ) )
	.output( void_() )
	.handler( async ( { input, context } ) => {
		const engine = await loadEngine( input.gameId, context );
		const { error } = await engine.reserveCard( input, context.authInfo );

		if ( error ) {
			logger.error( "Error Reserving Card:", error );
			throw new ORPCError( "BAD_REQUEST", { message: "Failed to reserve card." } );
		}
	} );

export const splendor = base.router( {
	createGame,
	getGameData,
	joinGame,
	addBots,
	startGame,
	pickTokens,
	purchaseCard,
	reserveCard
} );

export const handler = new RPCHandler( splendor );

export type SplendorRouter = typeof splendor;
export type SplendorClient = RouterClient<SplendorRouter>;