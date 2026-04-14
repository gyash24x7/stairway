import { requireAuthInfo } from "@/auth/core/utils";
import { fishEngine } from "@/fish/core/engine";
import type { Book, FishConfig } from "@/fish/core/types";
import { CANADIAN_BOOKS, NORMAL_BOOKS } from "@/fish/core/utils";
import { SORTED_DECK } from "@/shared/utils/cards";
import { createLogger } from "@/shared/utils/logger";
import { createServerFn } from "@tanstack/react-start";
import * as v from "valibot";

const logger = createLogger( "Fish:Actions" );

function buildConfig( input: {
	playerCount: 4 | 6 | 8;
	type: "NORMAL" | "CANADIAN";
	teamCount: 2 | 3 | 4;
} ): FishConfig {
	const isCanadian = input.type === "CANADIAN";
	const books = ( isCanadian
		? Object.keys( CANADIAN_BOOKS )
		: Object.keys( NORMAL_BOOKS ) ) as Book[];

	return {
		type: input.type,
		playerCount: input.playerCount,
		teamCount: input.teamCount,
		deckType: isCanadian ? 48 : 52,
		books,
		bookSize: isCanadian ? 6 : 4,
		autoStart: false
	};
}

export const getMatch = createServerFn( { method: "GET" } )
	.inputValidator( v.object( { matchId: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { matchId }, context: { authInfo } } ) => {
		logger.debug( ">> getMatch()" );

		const match = await fishEngine.getMatch( matchId );
		if ( !match ) {
			throw new Response( null, { status: 404 } );
		}

		const data = fishEngine.getPlayerView( match, authInfo.id );
		logger.debug( "<< getMatch()" );
		return { ...match, state: { ...match.state, data } };
	} );

export const createMatch = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		playerCount: v.picklist( [ 4, 6, 8 ] ),
		type: v.picklist( [ "NORMAL", "CANADIAN" ] ),
		teamCount: v.picklist( [ 2, 3, 4 ] )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> createMatch()" );

		const config = buildConfig( input );
		const match = await fishEngine.createMatch( config );
		await fishEngine.joinMatch( match.code, authInfo );

		logger.debug( "<< createMatch()" );
		return match.id;
	} );

export const joinMatch = createServerFn( { method: "POST" } )
	.inputValidator( v.object( { code: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { code }, context: { authInfo } } ) => {
		logger.debug( ">> joinMatch()" );

		const match = await fishEngine.joinMatch( code, authInfo );

		logger.debug( "<< joinMatch()" );
		return match.id;
	} );

export const addBots = createServerFn( { method: "POST" } )
	.inputValidator( v.object( { matchId: v.string() } ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: { matchId } } ) => {
		logger.debug( ">> addBots()" );

		await fishEngine.addBots( matchId );

		logger.debug( "<< addBots()" );
	} );

export const createTeams = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		matchId: v.string(),
		teams: v.record( v.string(), v.array( v.string() ) )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> createTeams()" );

		await fishEngine.processMove( input.matchId, authInfo.id, "createTeams", input );
		await fishEngine.startMatch( input.matchId );

		logger.debug( "<< createTeams()" );
	} );

export const askCard = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		matchId: v.string(),
		from: v.string(),
		cardId: v.picklist( SORTED_DECK )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> askCard()" );

		await fishEngine.processMove( input.matchId, authInfo.id, "askCard", input );

		logger.debug( "<< askCard()" );
	} );

export const claimBook = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		matchId: v.string(),
		claim: v.record( v.picklist( SORTED_DECK ), v.string() )
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> claimBook()" );

		await fishEngine.processMove( input.matchId, authInfo.id, "claimBook", input );

		logger.debug( "<< claimBook()" );
	} );

export const transferTurn = createServerFn( { method: "POST" } )
	.inputValidator( v.object( {
		matchId: v.string(),
		transferTo: v.string()
	} ) )
	.middleware( [ requireAuthInfo ] )
	.handler( async ( { data: input, context: { authInfo } } ) => {
		logger.debug( ">> transferTurn()" );

		await fishEngine.processMove( input.matchId, authInfo.id, "transferTurn", input );

		logger.debug( "<< transferTurn()" );
	} );
