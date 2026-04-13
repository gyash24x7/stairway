import { requireAuthInfo } from "@/auth/core/utils";
import { createLogger } from "@/shared/utils/logger";
import { ticTacToeEngine } from "@/tictactoe/core/engine";
import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";

const logger = createLogger( "TicTacToe:Actions" );

export const getMatch = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { matchId: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { matchId }, context: { authInfo } } ) => {
		logger.debug( ">> getMatch()" );

		const match = await ticTacToeEngine.getMatch( matchId );
		if ( !match ) {
			throw new Response( null, { status: 404 } );
		}

		const data = ticTacToeEngine.getPlayerView( match, authInfo.id );
		logger.debug( "<< getMatch()" );
		return { ...match, state: { ...match.state, data } };
	} );

export const createMatch = createServerFn( { method: "POST" } )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { context: { authInfo } } ) => {
		logger.debug( ">> createMatch()" );

		const match = await ticTacToeEngine.createMatch( { playerCount: 2 } );
		await ticTacToeEngine.joinMatch( match.code, authInfo );

		logger.debug( "<< createMatch()" );
		return match.id;
	} );

export const joinMatch = createServerFn( { method: "POST" } )
	.inputValidator( v.object( { code: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { code }, context: { authInfo } } ) => {
		logger.debug( ">> joinMatch()" );

		const match = await ticTacToeEngine.joinMatch( code, authInfo );

		logger.debug( "<< joinMatch()" );
		return match.id;
	} );

export const placeMove = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		matchId: v.string(),
		position: v.pipe( v.number(), v.integer(), v.minValue( 0 ), v.maxValue( 8 ) )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> placeMove()" );

		await ticTacToeEngine.processMove( input.matchId, authInfo.id, "place", input );

		logger.debug( "<< placeMove()" );
	} );
