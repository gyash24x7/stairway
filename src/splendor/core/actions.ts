import { requireAuthInfo } from "@/auth/core/utils";
import { createLogger } from "@/shared/utils/logger";
import { splendorEngine } from "@/splendor/core/engine";
import { GEMS } from "@/splendor/core/utils";
import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";

const logger = createLogger( "Splendor:Actions" );

export const getMatch = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { matchId: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { matchId }, context: { authInfo } } ) => {
		logger.debug( ">> getMatch()" );

		const match = await splendorEngine.getMatch( matchId );
		if ( !match ) {
			throw new Response( null, { status: 404 } );
		}

		const data = splendorEngine.getPlayerView( match, authInfo.id );
		logger.debug( "<< getMatch()" );
		return { ...match, state: { ...match.state, data } };
	} );

export const createMatch = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		playerCount: v.pipe( v.number(), v.integer(), v.minValue( 2 ), v.maxValue( 4 ) ),
		winningPoints: v.pipe( v.number(), v.integer(), v.minValue( 1 ) )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { playerCount, winningPoints }, context: { authInfo } } ) => {
		logger.debug( ">> createMatch()" );

		const match = await splendorEngine.createMatch( { playerCount, winningPoints } );
		await splendorEngine.joinMatch( match.code, authInfo );

		logger.debug( "<< createMatch()" );
		return match.id;
	} );

export const joinMatch = createServerFn( { method: "POST" } )
	.inputValidator( v.object( { code: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { code }, context: { authInfo } } ) => {
		logger.debug( ">> joinMatch()" );

		const match = await splendorEngine.joinMatch( code, authInfo );

		logger.debug( "<< joinMatch()" );
		return match.id;
	} );

export const pickTokens = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		matchId: v.string(),
		tokens: v.record( v.picklist( GEMS ), v.number() ),
		returned: v.optional( v.record( v.picklist( GEMS ), v.number() ) )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> pickTokens()" );

		await splendorEngine.processMove( input.matchId, authInfo.id, "pickTokens", input );

		logger.debug( "<< pickTokens()" );
	} );

export const reserveCard = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		matchId: v.string(),
		cardId: v.string(),
		withGold: v.boolean(),
		returnedToken: v.optional( v.picklist( GEMS ) )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> reserveCard()" );

		await splendorEngine.processMove( input.matchId, authInfo.id, "reserveCard", input );

		logger.debug( "<< reserveCard()" );
	} );

export const purchaseCard = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		matchId: v.string(),
		cardId: v.string(),
		payment: v.record( v.string(), v.number() )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> purchaseCard()" );

		await splendorEngine.processMove( input.matchId, authInfo.id, "purchaseCard", input );

		logger.debug( "<< purchaseCard()" );
	} );
