import { requireAuthInfo } from "@/auth/core/utils";
import { createLogger } from "@/shared/utils/logger";
import { wordleEngine } from "@/wordle/core/engine";
import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";

const logger = createLogger( "Wordle:Actions" );

export const getMatch = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { matchId: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { matchId }, context: { authInfo } } ) => {
		logger.debug( ">> getMatch()" );

		const match = await wordleEngine.getMatch( matchId );
		if ( !match ) {
			throw new Response( null, { status: 404 } );
		}

		const data = wordleEngine.getPlayerView( match, authInfo.id );
		logger.debug( "<< getMatch()" );
		return { ...match, state: { ...match.state, data } };
	} );

export const createMatch = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		wordCount: v.pipe( v.number(), v.integer(), v.minValue( 1 ) ),
		wordLength: v.picklist( [ 4, 5, 6 ] )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { wordCount, wordLength }, context: { authInfo } } ) => {
		logger.debug( ">> createMatch()" );

		const match = await wordleEngine.createMatch( { playerCount: 1, wordCount, wordLength } );
		await wordleEngine.joinMatch( match.code, authInfo );

		logger.debug( "<< createMatch()" );
		return match.id;
	} );

export const submitGuess = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		matchId: v.string(),
		guess: v.string()
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> submitGuess()" );

		await wordleEngine.processMove( input.matchId, authInfo.id, "guess", input );

		logger.debug( "<< submitGuess()" );
	} );

export const getWords = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { matchId: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { matchId } } ) => {
		logger.debug( ">> getWords()" );

		const match = await wordleEngine.getMatch( matchId );
		if ( !match ) {
			throw new Response( null, { status: 404 } );
		}

		logger.debug( "<< getWords()" );
		return match.state.data.words;
	} );
