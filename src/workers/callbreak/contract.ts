import { CARD_IDS, CARD_SUITS } from "@/utils/cards";
import { type PlayerGameInfo } from "@/workers/callbreak/types";
import { oc } from "@orpc/contract";
import { custom, length, ltValue, number, object, optional, picklist, pipe, string, trim, ulid, void_ } from "valibot";

export const contract = {
	createGame: oc
		.input( object( {
			dealCount: optional( pipe( number(), picklist( [ 5, 9, 13 ] ) ) ),
			trumpSuit: picklist( Object.values( CARD_SUITS ) ),
			gameId: optional( pipe( string(), ulid() ) )
		} ) )
		.output( object( { gameId: pipe( string(), ulid() ) } ) ),

	joinGame: oc
		.input( object( { code: pipe( string(), trim(), length( 6 ) ) } ) )
		.output( object( { gameId: pipe( string(), ulid() ) } ) ),

	getGameData: oc
		.input( object( { gameId: pipe( string(), ulid() ) } ) )
		.output( custom<PlayerGameInfo>( () => true ) ),

	declareDealWins: oc
		.input( object( {
			wins: pipe( number(), ltValue( 13 ) ),
			dealId: pipe( string(), ulid() ),
			gameId: pipe( string(), ulid() )
		} ) )
		.output( void_() ),

	playCard: oc
		.input( object( {
			cardId: picklist( CARD_IDS ),
			roundId: pipe( string(), ulid() ),
			dealId: pipe( string(), ulid() ),
			gameId: pipe( string(), ulid() )
		} ) )
		.output( void_() )
};