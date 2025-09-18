import { type PlayerGameInfo } from "@/callbreak/types";
import { service } from "@/callbreak/worker/service";
import { CARD_IDS, CARD_SUITS } from "@/shared/utils/cards";
import { requireAuth } from "@/worker";
import { os } from "@orpc/server";
import { custom, length, ltValue, number, object, optional, picklist, pipe, string, trim, ulid, void_ } from "valibot";

const createGame = os.$context<Ctx>().use( requireAuth )
	.input( object( {
		dealCount: optional( pipe( number(), picklist( [ 5, 9, 13 ] ) ) ),
		trumpSuit: picklist( Object.values( CARD_SUITS ) ),
		gameId: optional( pipe( string(), ulid() ) )
	} ) )
	.output( object( { gameId: pipe( string(), ulid() ) } ) )
	.handler( ( { input, context } ) => service.createGame( input, context.session.authInfo ) );

const joinGame = os.$context<Ctx>().use( requireAuth )
	.input( object( { code: pipe( string(), trim(), length( 6 ) ) } ) )
	.output( object( { gameId: pipe( string(), ulid() ) } ) )
	.handler( ( { input, context } ) => service.joinGame( input, context.session.authInfo ) );

const getGameData = os.$context<Ctx>().use( requireAuth )
	.input( object( { gameId: pipe( string(), ulid() ) } ) )
	.output( custom<PlayerGameInfo>( () => true ) )
	.handler( ( { input, context } ) => service.getGameData( input, context.session.authInfo ) );

const declareDealWins = os.$context<Ctx>().use( requireAuth )
	.input( object( {
		wins: pipe( number(), ltValue( 13 ) ),
		dealId: pipe( string(), ulid() ),
		gameId: pipe( string(), ulid() )
	} ) )
	.output( void_() )
	.handler( ( { input, context } ) => service.declareDealWins( input, context.session.authInfo ) );

const playCard = os.$context<Ctx>().use( requireAuth )
	.input( object( {
		cardId: picklist( CARD_IDS ),
		roundId: pipe( string(), ulid() ),
		dealId: pipe( string(), ulid() ),
		gameId: pipe( string(), ulid() )
	} ) )
	.output( void_() )
	.handler( ( { input, context } ) => service.playCard( input, context.session.authInfo ) );

export const router = {
	createGame,
	joinGame,
	getGameData,
	declareDealWins,
	playCard
};