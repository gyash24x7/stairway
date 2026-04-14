import { requireAuthInfo } from "@/auth/core/utils";
import { kingdominoEngine } from "@/kingdomino/core/engine";
import { createLogger } from "@/shared/utils/logger";
import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";

const logger = createLogger( "Kingdomino:Actions" );

export const getMatch = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { matchId: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { matchId }, context: { authInfo } } ) => {
		logger.debug( ">> getMatch()" );

		const match = await kingdominoEngine.getMatch( matchId );
		if ( !match ) {
			throw new Response( null, { status: 404 } );
		}

		const data = kingdominoEngine.getPlayerView( match, authInfo.id );
		logger.debug( "<< getMatch()" );
		return { ...match, state: { ...match.state, data } };
	} );

export const createMatch = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		playerCount: v.pipe( v.number(), v.integer(), v.minValue( 2 ), v.maxValue( 4 ) ),
		boardSize: v.picklist( [ 5, 7 ] )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { playerCount, boardSize }, context: { authInfo } } ) => {
		logger.debug( ">> createMatch()" );

		const effectiveBoardSize = playerCount <= 2 ? 7 : boardSize;
		const match = await kingdominoEngine.createMatch( { playerCount, boardSize: effectiveBoardSize } );
		await kingdominoEngine.joinMatch( match.code, authInfo );

		logger.debug( "<< createMatch()" );
		return match.id;
	} );

export const joinMatch = createServerFn( { method: "POST" } )
	.inputValidator( v.object( { code: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { code }, context: { authInfo } } ) => {
		logger.debug( ">> joinMatch()" );

		const match = await kingdominoEngine.joinMatch( code, authInfo );

		logger.debug( "<< joinMatch()" );
		return match.id;
	} );

export const selectDomino = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		matchId: v.string(),
		dominoId: v.number()
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> selectDomino()" );

		await kingdominoEngine.processMove( input.matchId, authInfo.id, "selectDomino", input );

		logger.debug( "<< selectDomino()" );
	} );

export const placeDomino = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		matchId: v.string(),
		placement: v.object( {
			dominoId: v.number(),
			coord: v.object( { x: v.number(), y: v.number() } ),
			rotation: v.picklist( [ 0, 90, 180, 270 ] )
		} )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> placeDomino()" );

		await kingdominoEngine.processMove( input.matchId, authInfo.id, "placeDomino", input );

		logger.debug( "<< placeDomino()" );
	} );

export const discardDomino = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		matchId: v.string(),
		dominoId: v.number()
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> discardDomino()" );

		await kingdominoEngine.processMove( input.matchId, authInfo.id, "discardDomino", input );

		logger.debug( "<< discardDomino()" );
	} );
