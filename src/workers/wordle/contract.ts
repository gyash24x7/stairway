import { type PlayerGameInfo } from "@/workers/wordle/types";
import { oc } from "@orpc/contract";
import { array, custom, gtValue, length, number, object, optional, picklist, pipe, string, ulid } from "valibot";

export const contract = {
	createGame: oc
		.input( object( {
			wordCount: optional( pipe( number(), gtValue( 0 ) ) ),
			wordLength: optional( pipe( number(), picklist( [ 5 ] ) ) ),
			gameId: optional( pipe( string(), ulid() ) )
		} ) )
		.output( object( { gameId: pipe( string(), ulid() ) } ) ),

	getGameData: oc
		.input( object( { gameId: pipe( string(), ulid() ) } ) )
		.output( custom<PlayerGameInfo>( () => true ) ),

	makeGuess: oc
		.input( object( {
			gameId: pipe( string(), ulid() ),
			guess: pipe( string(), length( 5 ) )
		} ) )
		.output( custom<PlayerGameInfo>( () => true ) ),

	getWords: oc
		.input( object( { gameId: pipe( string(), ulid() ) } ) )
		.output( array( string() ) )
};