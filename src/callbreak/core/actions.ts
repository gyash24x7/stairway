import { requireAuthInfo } from "@/auth/core/utils";
import { callbreakEngine } from "@/callbreak/core/engine";
import { CARD_SUITS, SORTED_DECK } from "@/shared/utils/cards";
import { createLogger } from "@/shared/utils/logger";
import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";

const logger = createLogger( "Callbreak:Actions" );

export const getMatch = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { matchId: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { matchId }, context: { authInfo } } ) => {
		logger.debug( ">> getMatch()" );

		const match = await callbreakEngine.getMatch( matchId );
		if ( !match ) {
			throw new Response( null, { status: 404 } );
		}

		const data = callbreakEngine.getPlayerView( match, authInfo.id );
		logger.debug( "<< getMatch()" );
		return { ...match, state: { ...match.state, data } };
	} );

export const createMatch = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		dealCount: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 10 ) ),
		trumpSuit: v.picklist( Object.values( CARD_SUITS ) )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { dealCount, trumpSuit }, context: { authInfo } } ) => {
		logger.debug( ">> createMatch()" );

		const match = await callbreakEngine.createMatch( { playerCount: 4, dealCount, trumpSuit } );
		await callbreakEngine.joinMatch( match.code, authInfo );

		logger.debug( "<< createMatch()" );
		return match.id;
	} );

export const joinMatch = createServerFn( { method: "POST" } )
	.inputValidator( v.object( { code: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { code }, context: { authInfo } } ) => {
		logger.debug( ">> joinMatch()" );

		const match = await callbreakEngine.joinMatch( code, authInfo );

		logger.debug( "<< joinMatch()" );
		return match.id;
	} );

export const addBots = createServerFn( { method: "POST" } )
	.inputValidator( v.object( { matchId: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { matchId } } ) => {
		logger.debug( ">> addBots()" );

		await callbreakEngine.addBots( matchId );

		logger.debug( "<< addBots()" );
	} );

export const declareWins = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		matchId: v.string(),
		wins: v.pipe( v.number(), v.integer(), v.minValue( 1 ), v.maxValue( 13 ) ),
		dealId: v.string()
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> declareWins()" );

		await callbreakEngine.processMove( input.matchId, authInfo.id, "declareWins", input );

		logger.debug( "<< declareWins()" );
	} );

export const playCard = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		matchId: v.string(),
		cardId: v.picklist( SORTED_DECK ),
		dealId: v.string()
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> playCard()" );

		await callbreakEngine.processMove( input.matchId, authInfo.id, "playCard", input );

		logger.debug( "<< playCard()" );
	} );
