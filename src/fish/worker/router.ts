import type { PlayerGameInfo } from "@/fish/types";
import { service } from "@/fish/worker/service";
import { CARD_IDS } from "@/shared/utils/cards";
import { requireAuth } from "@/worker";
import { os } from "@orpc/server";
import { array, custom, length, object, optional, picklist, pipe, record, string, trim, ulid, void_ } from "valibot";

const createGame = os.$context<Ctx>().use( requireAuth )
	.input( object( { playerCount: optional( picklist( [ 3, 4, 6, 8 ] ) ) } ) )
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

const createTeams = os.$context<Ctx>().use( requireAuth )
	.input( object( {
		gameId: pipe( string(), ulid() ),
		data: record( string(), array( pipe( string(), ulid() ) ) )
	} ) )
	.output( void_() )
	.handler( ( { input, context } ) => service.createTeams( input, context.session.authInfo ) );

const startGame = os.$context<Ctx>().use( requireAuth )
	.input( object( {
		gameId: pipe( string(), ulid() ),
		type: pipe( picklist( [ "NORMAL", "CANADIAN" ] ) ),
		deckType: pipe( picklist( [ 48, 52 ] ) )
	} ) )
	.output( void_() )
	.handler( ( { input, context } ) => service.startGame( input, context.session.authInfo ) );

const askCard = os.$context<Ctx>().use( requireAuth )
	.input( object( {
		gameId: pipe( string(), ulid() ),
		from: pipe( string(), ulid() ),
		cardId: picklist( CARD_IDS )
	} ) )
	.output( void_() )
	.handler( ( { input, context } ) => service.askCard( input, context.session.authInfo ) );

const claimBook = os.$context<Ctx>().use( requireAuth )
	.input( object( {
		gameId: pipe( string(), ulid() ),
		claim: record( picklist( CARD_IDS ), pipe( string(), ulid() ) )
	} ) )
	.output( void_() )
	.handler( ( { input, context } ) => service.claimBook( input, context.session.authInfo ) );

const transferTurn = os.$context<Ctx>().use( requireAuth )
	.input( object( {
		gameId: pipe( string(), ulid() ),
		transferTo: pipe( string(), ulid() )
	} ) )
	.output( void_() )
	.handler( ( { input, context } ) => service.transferTurn( input, context.session.authInfo ) );

export const router = {
	createGame,
	joinGame,
	getGameData,
	createTeams,
	startGame,
	askCard,
	claimBook,
	transferTurn
};