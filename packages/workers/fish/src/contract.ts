import { oc } from "@orpc/contract";
import { CARD_IDS } from "@s2h/cards/constants";
import type { PlayerGameInfo } from "@s2h/fish/types";
import { array, custom, length, object, optional, picklist, pipe, record, string, trim, ulid, void_ } from "valibot";

export default {
	createGame: oc
		.input( object( { playerCount: optional( picklist( [ 3, 4, 6, 8 ] ) ) } ) )
		.output( pipe( string(), ulid() ) ),

	joinGame: oc
		.input( object( { code: pipe( string(), trim(), length( 6 ) ) } ) )
		.output( pipe( string(), ulid() ) ),

	getGameData: oc
		.input( pipe( string(), ulid() ) )
		.output( custom<PlayerGameInfo>( () => true ) ),

	createTeams: oc
		.input( object( {
			gameId: pipe( string(), ulid() ),
			data: record( string(), array( pipe( string(), ulid() ) ) )
		} ) )
		.output( void_() ),

	startGame: oc
		.input( object( {
			gameId: pipe( string(), ulid() ),
			type: pipe( picklist( [ "NORMAL", "CANADIAN" ] ) ),
			deckType: pipe( picklist( [ 48, 52 ] ) )
		} ) )
		.output( void_() ),

	askCard: oc
		.input( object( {
			gameId: pipe( string(), ulid() ),
			from: pipe( string(), ulid() ),
			cardId: picklist( CARD_IDS )
		} ) )
		.output( void_() ),

	claimBook: oc
		.input( object( {
			gameId: pipe( string(), ulid() ),
			claim: record( picklist( CARD_IDS ), pipe( string(), ulid() ) )
		} ) )
		.output( void_() ),

	transferTurn: oc
		.input( object( {
			gameId: pipe( string(), ulid() ),
			transferTo: pipe( string(), ulid() )
		} ) )
		.output( void_() )
};