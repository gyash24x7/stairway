import { oc } from "@orpc/contract";
import type { PlayerGameInfo } from "@s2h/callbreak/types";
import { CARD_IDS, CARD_SUITS } from "@s2h/cards/constants";
import { custom, length, ltValue, number, object, optional, picklist, pipe, string, trim, ulid, void_ } from "valibot";

export default {
	createGame: oc
		.input( object( {
			dealCount: optional( pipe( number(), picklist( [ 5, 9, 13 ] ) ) ),
			trumpSuit: picklist( Object.values( CARD_SUITS ) ),
			gameId: optional( pipe( string(), ulid() ) )
		} ) )
		.output( pipe( string(), ulid() ) ),

	joinGame: oc
		.input( object( { code: pipe( string(), trim(), length( 6 ) ) } ) )
		.output( pipe( string(), ulid() ) ),

	getGameData: oc
		.input( pipe( string(), ulid() ) )
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